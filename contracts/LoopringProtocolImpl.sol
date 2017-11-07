/*

  Copyright 2017 Loopring Project Ltd (Loopring Foundation).

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.

*/
pragma solidity 0.4.18;

import "zeppelin-solidity/contracts/math/Math.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";

import "./lib/UintLib.sol";
import "./LoopringProtocol.sol";
import "./RinghashRegistry.sol";
import "./TokenRegistry.sol";
import "./TokenTransferDelegate.sol";


/// @title Loopring Token Exchange Protocol Implementation Contract v1
/// @author Daniel Wang - <daniel@loopring.org>,
/// @author Kongliang Zhong - <kongliang@loopring.org>
contract LoopringProtocolImpl is LoopringProtocol {
    using Math      for uint;
    using SafeMath  for uint;
    using UintLib   for uint;

    ////////////////////////////////////////////////////////////////////////////
    /// Variables                                                            ///
    ////////////////////////////////////////////////////////////////////////////

    address public  lrcTokenAddress             = address(0);
    address public  tokenRegistryAddress        = address(0);
    address public  ringhashRegistryAddress     = address(0);
    address public  delegateAddress             = address(0);

    uint    public  maxRingSize                 = 0;
    uint64  public  ringIndex                   = 0;

    // Exchange rate (rate) is the amount to sell or sold divided by the amount
    // to buy or bought.
    //
    // Rate ratio is the ratio between executed rate and an order's original
    // rate.
    //
    // To require all orders' rate ratios to have coefficient ofvariation (CV)
    // smaller than 2.5%, for an example , rateRatioCVSThreshold should be:
    //     `(0.025 * RATE_RATIO_SCALE)^2` or 62500.
    uint    public  rateRatioCVSThreshold       = 0;

    uint    public constant RATE_RATIO_SCALE    = 10000;

    uint64  public constant ENTERED_MASK = 1 << 63;

    // The following map is used to keep trace of order fill and cancellation
    // history.
    mapping (bytes32 => uint) public cancelledOrFilled;

    // A map from address to its cutoff timestamp.
    mapping (address => uint) public cutoffs;

    ////////////////////////////////////////////////////////////////////////////
    /// Structs                                                              ///
    ////////////////////////////////////////////////////////////////////////////

    struct Rate {
        uint amountS;
        uint amountB;
    }

    /// @param order        The original order
    /// @param orderHash    The order's hash
    /// @param feeSelection -
    ///                     A miner-supplied value indicating if LRC (value = 0)
    ///                     or margin split is choosen by the miner (value = 1).
    ///                     We may support more fee model in the future.
    /// @param rate         Exchange rate provided by miner.
    /// @param availableAmountS -
    ///                     The actual spendable amountS.
    /// @param fillAmountS  Amount of tokenS to sell, calculated by protocol.
    /// @param lrcReward    The amount of LRC paid by miner to order owner in
    ///                     exchange for margin split.
    /// @param lrcFee       The amount of LR paid by order owner to miner.
    /// @param splitS      TokenS paid to miner.
    /// @param splitB      TokenB paid to miner.
    struct OrderState {
        Order   order;
        bytes32 orderHash;
        uint8   feeSelection;
        Rate    rate;
        uint    availableAmountS;
        uint    fillAmountS;
        uint    lrcReward;
        uint    lrcFee;
        uint    splitS;
        uint    splitB;
    }

    struct Ring {
        uint         size;
        bytes32      ringhash;
        OrderState[] orders;
        address      miner;
        address      feeRecepient;
        bool         throwIfLRCIsInsuffcient;
    }


    ////////////////////////////////////////////////////////////////////////////
    /// Events                                                               ///
    ////////////////////////////////////////////////////////////////////////////

    event RingMined(
        uint                _ringIndex,
        uint                _time,
        uint                _blocknumber,
        bytes32     indexed _ringhash,
        address     indexed _miner,
        address     indexed _feeRecepient,
        bool                _isRinghashReserved);

    event OrderFilled(
        uint                _ringIndex,
        uint                _time,
        uint                _blocknumber,
        bytes32     indexed _ringhash,
        bytes32             _prevOrderHash,
        bytes32     indexed _orderHash,
        bytes32              _nextOrderHash,
        uint                _amountS,
        uint                _amountB,
        uint                _lrcReward,
        uint                _lrcFee);

    event OrderCancelled(
        uint                _time,
        uint                _blocknumber,
        bytes32     indexed _orderHash,
        uint                _amountCancelled);

    event CutoffTimestampChanged(
        uint                _time,
        uint                _blocknumber,
        address     indexed _address,
        uint                _cutoff);


    ////////////////////////////////////////////////////////////////////////////
    /// Constructor                                                          ///
    ////////////////////////////////////////////////////////////////////////////

    function LoopringProtocolImpl(
        address _lrcTokenAddress,
        address _tokenRegistryAddress,
        address _ringhashRegistryAddress,
        address _delegateAddress,
        uint    _maxRingSize,
        uint    _rateRatioCVSThreshold
        )
        public
    {
        require(address(0) != _lrcTokenAddress);
        require(address(0) != _tokenRegistryAddress);
        require(address(0) != _delegateAddress);

        require(_maxRingSize > 1);
        require(_rateRatioCVSThreshold > 0);

        lrcTokenAddress = _lrcTokenAddress;
        tokenRegistryAddress = _tokenRegistryAddress;
        ringhashRegistryAddress = _ringhashRegistryAddress;
        delegateAddress = _delegateAddress;
        maxRingSize = _maxRingSize;
        rateRatioCVSThreshold = _rateRatioCVSThreshold;
    }

    ////////////////////////////////////////////////////////////////////////////
    /// Public Functions                                                     ///
    ////////////////////////////////////////////////////////////////////////////

    /// @dev Disable default function.
    function ()
        payable
        public
    {
        revert();
    }

    /// @dev Submit a order-ring for validation and settlement.
    /// @param addressList  List of each order's tokenS. Note that next order's
    ///                     `tokenS` equals this order's `tokenB`.
    /// @param uintArgsList List of uint-type arguments in this order:
    ///                     amountS, amountB, timestamp, ttl, salt, lrcFee,
    ///                     rateAmountS.
    /// @param uint8ArgsList -
    ///                     List of unit8-type arguments, in this order:
    ///                     marginSplitPercentageList,feeSelectionList.
    /// @param buyNoMoreThanAmountBList -
    ///                     This indicates when a order should be considered
    ///                     as 'completely filled'.
    /// @param vList        List of v for each order. This list is 1-larger than
    ///                     the previous lists, with the last element being the
    ///                     v value of the ring signature.
    /// @param rList        List of r for each order. This list is 1-larger than
    ///                     the previous lists, with the last element being the
    ///                     r value of the ring signature.
    /// @param sList        List of s for each order. This list is 1-larger than
    ///                     the previous lists, with the last element being the
    ///                     s value of the ring signature.
    /// @param ringminer    The address that signed this tx.
    /// @param feeRecepient The recepient address for fee collection. If this is
    ///                     '0x0', all fees will be paid to the address who had
    ///                     signed this transaction, not `msg.sender`. Noted if
    ///                     LRC need to be paid back to order owner as the result
    ///                     of fee selection model, LRC will also be sent from
    ///                     this address.
    /// @param throwIfLRCIsInsuffcient -
    ///                     If true, throw exception if any order's spendable
    ///                     LRC amount is smaller than requried; if false, ring-
    ///                     minor will give up collection the LRC fee.
    function submitRing(
        address[2][]    addressList,
        uint[7][]       uintArgsList,
        uint8[2][]      uint8ArgsList,
        bool[]          buyNoMoreThanAmountBList,
        uint8[]         vList,
        bytes32[]       rList,
        bytes32[]       sList,
        address         ringminer,
        address         feeRecepient,
        bool            throwIfLRCIsInsuffcient
        )
        public
    {
        // Check if the highest bit of ringIndex is '1'.
        require(ringIndex & ENTERED_MASK != ENTERED_MASK); // "attempted to re-ent submitRing function");

        // Set the highest bit of ringIndex to '1'.
        ringIndex |= ENTERED_MASK;

        //Check ring size
        uint ringSize = addressList.length;
        require(ringSize > 1 && ringSize <= maxRingSize); // "invalid ring size");

        verifyInputDataIntegrity(
            ringSize,
            addressList,
            uintArgsList,
            uint8ArgsList,
            buyNoMoreThanAmountBList,
            vList,
            rList,
            sList
        );

        verifyTokensRegistered(addressList, ringSize);

        var (ringhash, ringhashAttributes) = RinghashRegistry(
            ringhashRegistryAddress
        ).computeAndGetRinghashInfo(
            ringSize,
            ringminer,
            vList,
            rList,
            sList
        );

        //Check if we can submit this ringhash.
        require(ringhashAttributes[0]); // "Ring claimed by others");

        verifySignature(
            ringminer,
            ringhash,
            vList[ringSize],
            rList[ringSize],
            sList[ringSize]
        );

        //Assemble input data into a struct so we can pass it to functions.
        var orders = assembleOrders(
            addressList,
            uintArgsList,
            uint8ArgsList,
            buyNoMoreThanAmountBList,
            vList,
            rList,
            sList
        );

        if (feeRecepient == address(0)) {
            feeRecepient = ringminer;
        }

        handleRing(
            ringhash,
            orders,
            ringminer,
            feeRecepient,
            throwIfLRCIsInsuffcient,
            ringhashAttributes[1]
        );

        ringIndex = ringIndex ^ ENTERED_MASK + 1;
    }

    /// @dev Cancel a order. cancel amount(amountS or amountB) can be specified
    ///      in orderValues.
    /// @param addresses          owner, tokenS, tokenB
    /// @param orderValues        amountS, amountB, timestamp, ttl, salt, lrcFee,
    ///                           cancelAmountS, and cancelAmountB.
    /// @param buyNoMoreThanAmountB -
    ///                           This indicates when a order should be considered
    ///                           as 'completely filled'.
    /// @param marginSplitPercentage -
    ///                           Percentage of margin split to share with miner.
    /// @param v                  Order ECDSA signature parameter v.
    /// @param r                  Order ECDSA signature parameters r.
    /// @param s                  Order ECDSA signature parameters s.
    function cancelOrder(
        address[3] addresses,
        uint[7]    orderValues,
        bool       buyNoMoreThanAmountB,
        uint8      marginSplitPercentage,
        uint8      v,
        bytes32    r,
        bytes32    s
        )
        public
    {
        uint cancelAmount = orderValues[6];

        require(cancelAmount > 0); // "amount to cancel is zero");

        var order = Order(
            addresses[0],
            addresses[1],
            addresses[2],
            orderValues[0],
            orderValues[1],
            orderValues[5],
            buyNoMoreThanAmountB,
            marginSplitPercentage
        );

        require(msg.sender == order.owner); // "cancelOrder not submitted by order owner");

        bytes32 orderHash = calculateOrderHash(
            order,
            orderValues[2], // timestamp
            orderValues[3], // ttl
            orderValues[4]  // salt
        );


        verifySignature(
            order.owner,
            orderHash,
            v,
            r,
            s
        );

        cancelledOrFilled[orderHash] = cancelledOrFilled[orderHash].add(cancelAmount);

        OrderCancelled(
            block.timestamp,
            block.number,
            orderHash,
            cancelAmount
        );
    }

    /// @dev   Set a cutoff timestamp to invalidate all orders whose timestamp
    ///        is smaller than or equal to the new value of the address's cutoff
    ///        timestamp.
    /// @param cutoff The cutoff timestamp, will default to `block.timestamp`
    ///        if it is 0.
    function setCutoff(uint cutoff)
        public
    {
        uint t = cutoff;
        if (t == 0) {
            t = block.timestamp;
        }

        require(cutoffs[msg.sender] < t); // "attempted to set cutoff to a smaller value");

        cutoffs[msg.sender] = t;

        CutoffTimestampChanged(
            block.timestamp,
            block.number,
            msg.sender,
            t
        );
    }

    ////////////////////////////////////////////////////////////////////////////
    /// Internal & Private Functions                                         ///
    ////////////////////////////////////////////////////////////////////////////

    /// @dev Validate a ring.
    function verifyRingHasNoSubRing(Ring ring)
        internal
        pure
    {
        // Check the ring has no sub-ring.
        for (uint i = 0; i < ring.size - 1; i++) {
            address tokenS = ring.orders[i].order.tokenS;
            for (uint j = i + 1; j < ring.size; j++) {
                require(tokenS != ring.orders[j].order.tokenS); // "found sub-ring");
            }
        }
    }

    function verifyTokensRegistered(
        address[2][] addressList,
        uint ringSize
        )
        internal
        view
    {
        // Extract the token addresses
        address[] memory tokens = new address[](ringSize);
        for (uint i = 0; i < ringSize; i++) {
            tokens[i] = addressList[i][1];
        }

        // Test all token addresses at once
        require(
            TokenRegistry(tokenRegistryAddress).areAllTokensRegistered(tokens)
        ); // "token not registered");
    }

    function handleRing(
        bytes32 ringhash,
        OrderState[] orders,
        address miner,
        address feeRecepient,
        bool throwIfLRCIsInsuffcient,
        bool isRinghashReserved
        )
        internal
    {
        var ring = Ring(
            orders.length,
            ringhash,
            orders,
            miner,
            feeRecepient,
            throwIfLRCIsInsuffcient
        );

        // Do the hard work.
        verifyRingHasNoSubRing(ring);

        // Exchange rates calculation are performed by ring-miners as solidity
        // cannot get power-of-1/n operation, therefore we have to verify
        // these rates are correct.
        verifyMinerSuppliedFillRates(ring);

        // Scale down each order independently by substracting amount-filled and
        // amount-cancelled. Order owner's current balance and allowance are
        // not taken into consideration in these operations.
        scaleRingBasedOnHistoricalRecords(ring);

        // Based on the already verified exchange rate provided by ring-miners,
        // we can furthur scale down orders based on token balance and allowance,
        // then find the smallest order of the ring, then calculate each order's
        // `fillAmountS`.
        calculateRingFillAmount(ring);

        var delegate = TokenTransferDelegate(delegateAddress);
        // Calculate each order's `lrcFee` and `lrcRewrard` and splict how much
        // of `fillAmountS` shall be paid to matching order or miner as margin
        // split.

        calculateRingFees(delegate, ring);

        /// Make payments.
        settleRing(delegate, ring);

        RingMined(
            ringIndex ^ ENTERED_MASK,
            block.timestamp,
            block.number,
            ring.ringhash,
            ring.miner,
            ring.feeRecepient,
            isRinghashReserved
        );
    }

    function settleRing(
        TokenTransferDelegate delegate,
        Ring ring
        )
        internal
    {
        for (uint i = 0; i < ring.size; i++) {
            var state = ring.orders[i];
            var prev = ring.orders[(i + ring.size - 1) % ring.size];
            var next = ring.orders[(i + 1) % ring.size];

            // Pay tokenS to previous order, or to miner as previous order's
            // margin split or/and this order's margin split.
            delegate.transferToken(
                state.order.tokenS,
                state.order.owner,
                prev.order.owner,
                state.fillAmountS - prev.splitB
            );

            uint splitSum = prev.splitB + state.splitS;
            if (splitSum > 0) {
                delegate.transferToken(
                    state.order.tokenS,
                    state.order.owner,
                    ring.feeRecepient,
                    splitSum
                );
            }

            // Pay LRC
            if (state.lrcReward > 0) {
                delegate.transferToken(
                    lrcTokenAddress,
                    ring.feeRecepient,
                    state.order.owner,
                    state.lrcReward
                );
            }

            if (state.lrcFee > 0) {
                delegate.transferToken(
                    lrcTokenAddress,
                    state.order.owner,
                    ring.feeRecepient,
                    state.lrcFee
                );
            }

            // Update fill records
            if (state.order.buyNoMoreThanAmountB) {
                cancelledOrFilled[state.orderHash] += next.fillAmountS;
            } else {
                cancelledOrFilled[state.orderHash] += state.fillAmountS;
            }

            OrderFilled(
                ringIndex ^ ENTERED_MASK,
                block.timestamp,
                block.number,
                ring.ringhash,
                prev.orderHash,
                state.orderHash,
                next.orderHash,
                state.fillAmountS + state.splitS,
                next.fillAmountS - state.splitB,
                state.lrcReward,
                state.lrcFee
            );
        }

    }

    function verifyMinerSuppliedFillRates(Ring ring)
        internal
        view
    {
        var orders = ring.orders;
        uint ringSize = orders.length;
        uint[] memory rateRatios = new uint[](ringSize);

        for (uint i = 0; i < ringSize; i++) {
            uint s1b0 = orders[i].rate.amountS.mul(orders[i].order.amountB);
            uint s0b1 = orders[i].order.amountS.mul(orders[i].rate.amountB);

            require(s1b0 <= s0b1); // "miner supplied exchange rate provides invalid discount");

            rateRatios[i] = RATE_RATIO_SCALE.mul(s1b0).div(s0b1);
        }

        uint cvs = UintLib.cvsquare(rateRatios, RATE_RATIO_SCALE);

        require(cvs <= rateRatioCVSThreshold); // "miner supplied exchange rate is not evenly discounted");
    }

    function calculateRingFees(TokenTransferDelegate delegate, Ring ring)
        internal
        view
    {
        uint minerLrcSpendable = delegate.getSpendable(
            lrcTokenAddress,
            ring.feeRecepient
        );

        for (uint i = 0; i < ring.size; i++) {
            var state = ring.orders[i];
            var next = ring.orders[(i + 1) % ring.size];

            if (state.feeSelection == FEE_SELECT_LRC) {

                uint lrcSpendable = delegate.getSpendable(
                    lrcTokenAddress,
                    state.order.owner
                );

                if (lrcSpendable < state.lrcFee) {
                    require(!ring.throwIfLRCIsInsuffcient); // "order LRC balance insuffcient");

                    state.lrcFee = lrcSpendable;
                    minerLrcSpendable += lrcSpendable;
                }

            } else if (state.feeSelection == FEE_SELECT_MARGIN_SPLIT) {
                if (minerLrcSpendable >= state.lrcFee) {
                    uint split;
                    if (state.order.buyNoMoreThanAmountB) {
                        split = next.fillAmountS.mul(
                            state.order.amountS
                        ).div(
                            state.order.amountB
                        ).sub(
                            state.fillAmountS
                        );

                        state.splitS = split.mul(
                            state.order.marginSplitPercentage
                        ).div(
                            MARGIN_SPLIT_PERCENTAGE_BASE
                        );
                    } else {
                        split = next.fillAmountS.sub(state.fillAmountS
                            .mul(state.order.amountB)
                            .div(state.order.amountS)
                        );

                        state.splitB = split.mul(
                            state.order.marginSplitPercentage
                        ).div(
                            MARGIN_SPLIT_PERCENTAGE_BASE
                        );
                    }

                    // This implicits order with smaller index in the ring will
                    // be paid LRC reward first, so the orders in the ring does
                    // mater.
                    if (state.splitS > 0 || state.splitB > 0) {
                        minerLrcSpendable = minerLrcSpendable.sub(state.lrcFee);
                        state.lrcReward = state.lrcFee;
                    }
                    state.lrcFee = 0;
                }
            } else {
                revert(); // "unsupported fee selection value");
            }
        }

    }

    function calculateRingFillAmount(Ring ring)
        internal
        view
    {
        uint smallestIdx = 0;
        uint i;
        uint j;

        for (i = 0; i < ring.size; i++) {
            j = (i + 1) % ring.size;

            uint res = calculateOrderFillAmount(
                ring.orders[i],
                ring.orders[j]
            );

            if (res == 1) {
                smallestIdx = i;
            } else if (res == 2) {
                smallestIdx = j;
            }
        }

        for (i = 0; i < smallestIdx; i++) {
            j = (i + 1) % ring.size;
            calculateOrderFillAmount(
                ring.orders[i],
                ring.orders[j]
            );
        }
    }

    /// @return 0 if neither order is the smallest one;
    ///         1 if 'state' is the smallest order;
    ///         2 if 'next' is the smallest order.
    function calculateOrderFillAmount(
        OrderState state,
        OrderState next
        )
        internal
        view
        returns (uint whichIsSmaller)
    {
        uint fillAmountB = state.fillAmountS.mul(
            state.rate.amountB
        ).div(
            state.rate.amountS
        );

        if (state.order.buyNoMoreThanAmountB) {
            if (fillAmountB > state.order.amountB) {
                fillAmountB = state.order.amountB;

                state.fillAmountS = fillAmountB.mul(
                    state.rate.amountS
                ).div(
                    state.rate.amountB
                );

                whichIsSmaller = 1;
            }
        }

        state.lrcFee = state.order.lrcFee.mul(
            state.fillAmountS
        ).div(
            state.order.amountS
        );

        if (fillAmountB <= next.fillAmountS) {
            next.fillAmountS = fillAmountB;
        } else {
            whichIsSmaller = 2;
        }
    }

    /// @dev Scale down all orders based on historical fill or cancellation
    ///      stats but key the order's original exchange rate.
    function scaleRingBasedOnHistoricalRecords(Ring ring)
        internal
        view
    {
        for (uint i = 0; i < ring.size; i++) {
            var state = ring.orders[i];
            var order = state.order;
            uint amount;

            if (order.buyNoMoreThanAmountB) {
                amount = order.amountB.tolerantSub(
                    cancelledOrFilled[state.orderHash]
                );

                order.amountS = amount.mul(order.amountS).div(order.amountB);
                order.lrcFee = amount.mul(order.lrcFee).div(order.amountB);

                order.amountB = amount;
            } else {
                amount = order.amountS.tolerantSub(
                    cancelledOrFilled[state.orderHash]
                );

                order.amountB = amount.mul(order.amountB).div(order.amountS);
                order.lrcFee = amount.mul(order.lrcFee).div(order.amountS);

                order.amountS = amount;
            }

            require(order.amountS > 0); // "amountS is zero");
            require(order.amountB > 0); // "amountB is zero");

            state.fillAmountS = order.amountS.min256(state.availableAmountS);
        }
    }

    /// @dev verify input data's basic integrity.
    function verifyInputDataIntegrity(
        uint ringSize,
        address[2][]    addressList,
        uint[7][]       uintArgsList,
        uint8[2][]      uint8ArgsList,
        bool[]          buyNoMoreThanAmountBList,
        uint8[]         vList,
        bytes32[]       rList,
        bytes32[]       sList
        )
        internal
        pure
    {
        require(ringSize == addressList.length); // "ring data is inconsistent - addressList");
        require(ringSize == uintArgsList.length); // "ring data is inconsistent - uintArgsList");
        require(ringSize == uint8ArgsList.length); // "ring data is inconsistent - uint8ArgsList");
        require(ringSize == buyNoMoreThanAmountBList.length); // "ring data is inconsistent - buyNoMoreThanAmountBList");
        require(ringSize + 1 == vList.length); // "ring data is inconsistent - vList");
        require(ringSize + 1 == rList.length); // "ring data is inconsistent - rList");
        require(ringSize + 1 == sList.length); // "ring data is inconsistent - sList");

        // Validate ring-mining related arguments.
        for (uint i = 0; i < ringSize; i++) {
            require(uintArgsList[i][6] > 0); // "order rateAmountS is zero");
            require(uint8ArgsList[i][1] <= FEE_SELECT_MAX_VALUE); // "invalid order fee selection");
        }
    }

    /// @dev        assmble order parameters into Order struct.
    /// @return     A list of orders.
    function assembleOrders(
        address[2][]    addressList,
        uint[7][]       uintArgsList,
        uint8[2][]      uint8ArgsList,
        bool[]          buyNoMoreThanAmountBList,
        uint8[]         vList,
        bytes32[]       rList,
        bytes32[]       sList
        )
        internal
        view
        returns (OrderState[])
    {
        var orders = new OrderState[](addressList.length);
        var delegate = TokenTransferDelegate(delegateAddress);

        for (uint i = 0; i < addressList.length; i++) {
            var order = Order(
                addressList[i][0],
                addressList[i][1],
                addressList[(i + 1) % addressList.length][1],
                uintArgsList[i][0],
                uintArgsList[i][1],
                uintArgsList[i][5],
                buyNoMoreThanAmountBList[i],
                uint8ArgsList[i][0]
            );

            bytes32 orderHash = calculateOrderHash(
                order,
                uintArgsList[i][2], // timestamp
                uintArgsList[i][3], // ttl
                uintArgsList[i][4]  // salt
            );

            verifySignature(
                order.owner,
                orderHash,
                vList[i],
                rList[i],
                sList[i]
            );

            validateOrder(
                order,
                uintArgsList[i][2], // timestamp
                uintArgsList[i][3], // ttl
                uintArgsList[i][4]  // salt
            );

            orders[i] = OrderState(
                order,
                orderHash,
                uint8ArgsList[i][1],  // feeSelection
                Rate(uintArgsList[i][6], order.amountB),
                delegate.getSpendable(order.tokenS, order.owner),
                0,   // fillAmountS
                0,   // lrcReward
                0,   // lrcFee
                0,   // splitS
                0    // splitB
            );

            require(orders[i].availableAmountS > 0); // "order spendable amountS is zero");
        }

        return orders;
    }

    /// @dev validate order's parameters are OK.
    function validateOrder(
        Order order,
        uint timestamp,
        uint ttl,
        uint salt
    )
        internal
        view 
    {
        require(order.owner != address(0)); // "invalid order owner");
        require(order.tokenS != address(0)); // "invalid order tokenS");
        require(order.tokenB != address(0)); // "invalid order tokenB");
        require(order.amountS != 0); // "invalid order amountS");
        require(order.amountB != 0); // "invalid order amountB");
        require(timestamp <= block.timestamp); // "order is too early to match");
        require(timestamp > cutoffs[order.owner]); // "order is cut off");
        require(ttl != 0); // "order ttl is 0");
        require(timestamp + ttl > block.timestamp); // "order is expired");
        require(salt != 0); // "invalid order salt");
        require(order.marginSplitPercentage <= MARGIN_SPLIT_PERCENTAGE_BASE); // "invalid order marginSplitPercentage");
    }

    /// @dev Get the Keccak-256 hash of order with specified parameters.
    function calculateOrderHash(
        Order order,
        uint timestamp,
        uint ttl,
        uint salt
    )
        internal
        view
        returns (bytes32)
    {
        return keccak256(
            address(this),
            order.owner,
            order.tokenS,
            order.tokenB,
            order.amountS,
            order.amountB,
            timestamp,
            ttl,
            salt,
            order.lrcFee,
            order.buyNoMoreThanAmountB,
            order.marginSplitPercentage
        );
    }

    /// @dev Verify signer's signature.
    function verifySignature(
        address signer,
        bytes32 hash,
        uint8   v,
        bytes32 r,
        bytes32 s)
        internal
        pure
    {
        require(
            signer == ecrecover(
                keccak256("\x19Ethereum Signed Message:\n32", hash),
                v,
                r,
                s
            )
        ); // "invalid signature");
    }

}
