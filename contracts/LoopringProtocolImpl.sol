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
pragma solidity 0.4.15;

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
    uint    public  ringIndex                   = 0;

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

    uint    public constant ENTERED_MASK = 1 << 255;

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
        bool                _ringhashFound);

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
        if (ringIndex & ENTERED_MASK == ENTERED_MASK) {
            ErrorLib.error("attempted to re-ent submitRing function");
        }

        // Set the highest bit of ringIndex to '1'.
        ringIndex |= ENTERED_MASK;

        //Check ring size
        uint ringSize = addressList.length;
        if (ringSize <= 1 || ringSize > maxRingSize) {
            ErrorLib.error("invalid ring size");
        }

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

        verifyTokensRegistered(addressList);

        var ringhashRegistry = RinghashRegistry(ringhashRegistryAddress);

        bytes32 ringhash = ringhashRegistry.calculateRinghash(
            ringSize,
            vList,
            rList,
            sList
        );

        if (!ringhashRegistry.canSubmit(ringhash, feeRecepient)) {
            ErrorLib.error("Ring claimed by others");
        }

        verifySignature(
            ringminer,
            ringhash,
            vList[ringSize],
            rList[ringSize],
            sList[ringSize]
        );

        //Assemble input data into a struct so we can pass it to functions.
        var orders = assembleOrders(
            ringSize,
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
            ringhashRegistry,
            ringhash,
            orders,
            ringminer,
            feeRecepient,
            throwIfLRCIsInsuffcient
        );

        ringIndex = ringIndex ^ ENTERED_MASK + 1;
    }

    /// @dev Cancel a order. Amount (amountS or amountB) to cancel can be
    ///                           specified using orderValues.
    /// @param addresses          owner, tokenS, tokenB
    /// @param orderValues        amountS, amountB, timestamp, ttl, salt,
    ///                           lrcFee, and cancelAmount
    /// @param buyNoMoreThanAmountB -
    ///                           If true, this order does not accept buying
    ///                           more than `amountB`.
    /// @param marginSplitPercentage -
    ///                           The percentage of margin paid to miner.
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

        if (cancelAmount == 0) {
            ErrorLib.error("amount to cancel is zero");
        } 

        var order = Order(
            addresses[0],
            addresses[1],
            addresses[2],
            orderValues[0],
            orderValues[1],
            orderValues[2],
            orderValues[3],
            orderValues[4],
            orderValues[5],
            buyNoMoreThanAmountB,
            marginSplitPercentage,
            v,
            r,
            s
        );

        if (msg.sender != order.owner) {
            ErrorLib.error("cancelOrder not submitted by order owner");
        }

        bytes32 orderHash = calculateOrderHash(order);

        verifySignature(
            order.owner,
            orderHash,
            order.v,
            order.r,
            order.s
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

        if (cutoffs[msg.sender] >= t) {
            ErrorLib.error("attempted to set cutoff to a smaller value");
        }

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
        constant
    {
        uint ringSize = ring.orders.length;
        // Check the ring has no sub-ring.
        for (uint i = 0; i < ringSize - 1; i++) {
            address tokenS = ring.orders[i].order.tokenS;
            for (uint j = i + 1; j < ringSize; j++) {
                if (tokenS == ring.orders[j].order.tokenS) {
                    ErrorLib.error("found sub-ring");
                }
            }
        }
    }

    function verifyTokensRegistered(address[2][] addressList)
        internal
        constant
    {
        // Extract the token addresses
        address[] memory tokens = new address[](addressList.length);
        for (uint i = 0; i < addressList.length; i++) {
            tokens[i] = addressList[i][1];
        }

        // Test all token addresses at once
        if (!TokenRegistry(tokenRegistryAddress).areAllTokensRegistered(tokens)) {
            ErrorLib.error("token not registered");
        }
    }

    function handleRing(
        RinghashRegistry ringhashRegistry,
        bytes32 ringhash,
        OrderState[] orders,
        address miner,
        address feeRecepient,
        bool throwIfLRCIsInsuffcient
        )
        internal
    {
        var ring = Ring(
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
            ringhashRegistry.ringhashFound(ring.ringhash)
        );
    }

    function settleRing(TokenTransferDelegate delegate, Ring ring)
        internal
    {
        uint ringSize = ring.orders.length;

        for (uint i = 0; i < ringSize; i++) {
            var state = ring.orders[i];
            var prev = ring.orders[i.prev(ringSize)];
            var next = ring.orders[i.next(ringSize)];

            // Pay tokenS to previous order, or to miner as previous order's
            // margin split or/and this order's margin split.

            delegate.transferToken(
                state.order.tokenS,
                state.order.owner,
                prev.order.owner,
                state.fillAmountS - prev.splitB
            );

            if (prev.splitB + state.splitS > 0) {
                delegate.transferToken(
                    state.order.tokenS,
                    state.order.owner,
                    ring.feeRecepient,
                    prev.splitB + state.splitS
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
        constant
    {
        var orders = ring.orders;
        uint ringSize = orders.length;
        uint[] memory rateRatios = new uint[](ringSize);

        for (uint i = 0; i < ringSize; i++) {
            uint s1b0 = orders[i].rate.amountS.mul(orders[i].order.amountB);
            uint s0b1 = orders[i].order.amountS.mul(orders[i].rate.amountB);
            
            if (s1b0 > s0b1) {
                ErrorLib.error("miner supplied exchange rate provides invalid discount");
            }

            rateRatios[i] = RATE_RATIO_SCALE.mul(s1b0).div(s0b1);
        }

        uint cvs = UintLib.cvsquare(rateRatios, RATE_RATIO_SCALE);

        if (cvs > rateRatioCVSThreshold) {
            ErrorLib.error("miner supplied exchange rate is not evenly discounted");
        }
    }

    function calculateRingFees(TokenTransferDelegate delegate, Ring ring)
        internal
        constant
    {
        uint minerLrcSpendable = delegate.getSpendable(lrcTokenAddress, ring.feeRecepient);
        uint ringSize = ring.orders.length;

        for (uint i = 0; i < ringSize; i++) {
            var state = ring.orders[i];
            var next = ring.orders[i.next(ringSize)];

            if (state.feeSelection == FEE_SELECT_LRC) {

                uint lrcSpendable = delegate.getSpendable(lrcTokenAddress, state.order.owner);

                if (lrcSpendable < state.lrcFee) {
                    if (ring.throwIfLRCIsInsuffcient) {
                        ErrorLib.error("order LRC balance insuffcient");
                    }

                    state.lrcFee = lrcSpendable;
                    minerLrcSpendable += lrcSpendable;
                }

            } else if (state.feeSelection == FEE_SELECT_MARGIN_SPLIT) {
                if (minerLrcSpendable >= state.lrcFee) {
                    if (state.order.buyNoMoreThanAmountB) {
                        uint splitS = next.fillAmountS.mul(
                            state.order.amountS
                        ).div(
                            state.order.amountB
                        ).sub(
                            state.fillAmountS
                        );

                        state.splitS = splitS.mul(
                            state.order.marginSplitPercentage
                        ).div(
                            MARGIN_SPLIT_PERCENTAGE_BASE
                        );
                    } else {
                        uint splitB = next.fillAmountS.sub(state.fillAmountS
                            .mul(state.order.amountB)
                            .div(state.order.amountS)
                        );

                        state.splitB = splitB.mul(
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
                ErrorLib.error("unsupported fee selection value");
            }
        }

    }

    function calculateRingFillAmount(Ring ring)
        internal
        constant
    {
        uint ringSize = ring.orders.length;
        uint smallestIdx = 0;
        uint i;
        uint j;

        for (i = 0; i < ringSize; i++) {
            j = i.next(ringSize);

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
            j = i.next(ringSize);
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
        constant
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
        constant
    {
        uint ringSize = ring.orders.length;

        for (uint i = 0; i < ringSize; i++) {
            var state = ring.orders[i];
            var order = state.order;

            if (order.buyNoMoreThanAmountB) {
                uint amountB = order.amountB.tolerantSub(
                    cancelledOrFilled[state.orderHash]
                );

                order.amountS = amountB.mul(order.amountS).div(order.amountB);
                order.lrcFee = amountB.mul(order.lrcFee).div(order.amountB);

                order.amountB = amountB;
            } else {
                uint amountS = order.amountS.tolerantSub(
                    cancelledOrFilled[state.orderHash]
                );

                order.amountB = amountS.mul(order.amountB).div(order.amountS);
                order.lrcFee = amountS.mul(order.lrcFee).div(order.amountS);

                order.amountS = amountS;
            }

            if (order.amountS == 0) {
                ErrorLib.error("amountS is zero");
            }
            if (order.amountB == 0) {
                ErrorLib.error("amountB is zero");
            }

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
        constant
    {
        if (ringSize != addressList.length) {
            ErrorLib.error("ring data is inconsistent - addressList");
        }    

        if (ringSize != uintArgsList.length) {
            ErrorLib.error("ring data is inconsistent - uintArgsList");
        }
        
        if (ringSize != uint8ArgsList.length) {
            ErrorLib.error("ring data is inconsistent - uint8ArgsList");
        }
        
        if (ringSize != buyNoMoreThanAmountBList.length) {
            ErrorLib.error("ring data is inconsistent - buyNoMoreThanAmountBList");
        }

        if (ringSize + 1 != vList.length) {
            ErrorLib.error("ring data is inconsistent - vList");
        }

        if (ringSize + 1 != rList.length) {
            ErrorLib.error("ring data is inconsistent - rList");
        }

        if (ringSize + 1 != sList.length) {
            ErrorLib.error("ring data is inconsistent - sList");
        }

        // Validate ring-mining related arguments.
        for (uint i = 0; i < ringSize; i++) {
            if (uintArgsList[i][6] == 0) {
                ErrorLib.error("order rateAmountS is zero");
            }
            
            if (uint8ArgsList[i][1] > FEE_SELECT_MAX_VALUE) {
                ErrorLib.error("invalid order fee selection");
            }
        }
    }

    /// @dev        assmble order parameters into Order struct.
    /// @return     A list of orders.
    function assembleOrders(
        uint            ringSize,
        address[2][]    addressList,
        uint[7][]       uintArgsList,
        uint8[2][]      uint8ArgsList,
        bool[]          buyNoMoreThanAmountBList,
        uint8[]         vList,
        bytes32[]       rList,
        bytes32[]       sList
        )
        internal
        constant
        returns (OrderState[])
    {
        var orders = new OrderState[](ringSize);

        for (uint i = 0; i < ringSize; i++) {
            uint j = i.next(ringSize);

            var order = Order(
                addressList[i][0],
                addressList[i][1],
                addressList[j][1],
                uintArgsList[i][0],
                uintArgsList[i][1],
                uintArgsList[i][2],
                uintArgsList[i][3],
                uintArgsList[i][4],
                uintArgsList[i][5],
                buyNoMoreThanAmountBList[i],
                uint8ArgsList[i][0],
                vList[i],
                rList[i],
                sList[i]
            );

            bytes32 orderHash = calculateOrderHash(order);

            verifySignature(
                order.owner,
                orderHash,
                order.v,
                order.r,
                order.s
            );

            validateOrder(order);

            orders[i] = OrderState(
                order,
                orderHash,
                uint8ArgsList[i][1],  // feeSelection
                Rate(uintArgsList[i][6], order.amountB),
                TokenTransferDelegate(delegateAddress).getSpendable(order.tokenS, order.owner),
                0,   // fillAmountS
                0,   // lrcReward
                0,   // lrcFee
                0,   // splitS
                0    // splitB
            );

            if (orders[i].availableAmountS == 0) {
                ErrorLib.error("order spendable amountS is zero");
            }
        }

        return orders;
    }

    /// @dev validate order's parameters are OK.
    function validateOrder(Order order)
        internal
        constant
    {
        if (order.owner == address(0)) {
            ErrorLib.error("invalid order owner");
        }

        if (order.tokenS == address(0)) {
            ErrorLib.error("invalid order tokenS");
        }

        if (order.tokenB == address(0)) {
            ErrorLib.error("invalid order tokenB");
        }

        if (order.amountS == 0) {
            ErrorLib.error("invalid order amountS");
        }

        if (order.amountB == 0) {
            ErrorLib.error("invalid order amountB");
        }

        if (order.timestamp > block.timestamp) {
            ErrorLib.error("order is too early to match");
        }

        if (order.timestamp <= cutoffs[order.owner]) {
            ErrorLib.error("order is cut off");
        }

        if (order.ttl == 0) {
            ErrorLib.error("order ttl is 0");
        }

        if (order.timestamp + order.ttl <= block.timestamp) {
            ErrorLib.error("order is expired");
        }

        if (order.salt == 0) {
            ErrorLib.error("invalid order salt");
        }

        if (order.marginSplitPercentage > MARGIN_SPLIT_PERCENTAGE_BASE) {
            ErrorLib.error("invalid order marginSplitPercentage");
        }
    }

    /// @dev Get the Keccak-256 hash of order with specified parameters.
    function calculateOrderHash(Order order)
        internal
        constant
        returns (bytes32)
    {
        return keccak256(
            address(this),
            order.owner,
            order.tokenS,
            order.tokenB,
            order.amountS,
            order.amountB,
            order.timestamp,
            order.ttl,
            order.salt,
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
        constant
    {
        address addr = ecrecover(
            keccak256("\x19Ethereum Signed Message:\n32", hash),
            v,
            r,
            s
        );

        if (signer != addr) {
            ErrorLib.error("invalid signature");
        }
    }

}
