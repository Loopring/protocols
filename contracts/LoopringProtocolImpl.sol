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

import "./lib/ERC20.sol";
import "./lib/MathUint.sol";
import "./LoopringProtocol.sol";
import "./RinghashRegistry.sol";
import "./TokenRegistry.sol";
import "./TokenTransferDelegate.sol";
import "./NameRegistry.sol";


/// @title Loopring Token Exchange Protocol Implementation Contract v1
/// @author Daniel Wang - <daniel@loopring.org>,
/// @author Kongliang Zhong - <kongliang@loopring.org>
///
/// Recognized contributing developers from the community:
///     https://github.com/Brechtpd
///     https://github.com/rainydio
///     https://github.com/BenjaminPrice
///     https://github.com/jonasshen
contract LoopringProtocolImpl is LoopringProtocol {
    using MathUint for uint;

    ////////////////////////////////////////////////////////////////////////////
    /// Variables                                                            ///
    ////////////////////////////////////////////////////////////////////////////

    address public  lrcTokenAddress             = 0x0;
    address public  tokenRegistryAddress        = 0x0;
    address public  ringhashRegistryAddress     = 0x0;
    address public  delegateAddress             = 0x0;
    address public  nameRegistryAddress         = 0x0;

    uint    public  maxRingSize                 = 0;
    uint64  public  ringIndex                   = 0;
    uint8   public  walletSplitPercentage       = 0;

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

    uint64  public constant ENTERED_MASK        = 1 << 63;

    // The following map is used to keep trace of order fill and cancellation
    // history.
    mapping (bytes32 => uint) public cancelledOrFilled;

    // This map is used to keep trace of order's cancellation history.
    mapping (bytes32 => uint) public cancelled;

    // A map from address to its cutoff timestamp.
    mapping (address => uint) public cutoffs;

    // A map from address to its trading-pair cutoff timestamp.
    mapping (address => mapping (bytes20 => uint)) public tradingPairCutoffs;

    ////////////////////////////////////////////////////////////////////////////
    /// Structs                                                              ///
    ////////////////////////////////////////////////////////////////////////////

    struct Rate {
        uint amountS;
        uint amountB;
    }

    /// @param tokenS       Token to sell.
    /// @param tokenB       Token to buy.
    /// @param amountS      Maximum amount of tokenS to sell.
    /// @param amountB      Minimum amount of tokenB to buy if all amountS sold.
    /// @param timestamp    Indicating when this order is created/signed.
    /// @param ttl          Indicating after how many seconds from `timestamp`
    ///                     this order will expire.
    /// @param salt         A random number to make this order's hash unique.
    /// @param lrcFee       Max amount of LRC to pay for miner. The real amount
    ///                     to pay is proportional to fill amount.
    /// @param buyNoMoreThanAmountB -
    ///                     If true, this order does not accept buying more
    ///                     than `amountB`.
    /// @param marginSplitPercentage -
    ///                     The percentage of margin paid to miner.
    /// @param v            ECDSA signature parameter v.
    /// @param r            ECDSA signature parameters r.
    /// @param s            ECDSA signature parameters s.
    struct Order {
        address owner;
        address tokenS;
        address tokenB;
        uint    amountS;
        uint    amountB;
        uint    lrcFee;
        bool    buyNoMoreThanAmountB;
        uint8   marginSplitPercentage;
    }

    /// @param order        The original order
    /// @param orderHash    The order's hash
    /// @param feeSelection -
    ///                     A miner-supplied value indicating if LRC (value = 0)
    ///                     or margin split is choosen by the miner (value = 1).
    ///                     We may support more fee model in the future.
    /// @param rate         Exchange rate provided by miner.
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
        uint    fillAmountS;
        uint    lrcReward;
        uint    lrcFee;
        uint    splitS;
        uint    splitB;
    }

    ////////////////////////////////////////////////////////////////////////////
    /// Constructor                                                          ///
    ////////////////////////////////////////////////////////////////////////////

    function LoopringProtocolImpl(
        address _lrcTokenAddress,
        address _tokenRegistryAddress,
        address _ringhashRegistryAddress,
        address _delegateAddress,
        address _nameRegistryAddress,
        uint    _maxRingSize,
        uint    _rateRatioCVSThreshold,
        uint8   _walletSplitPercentage
        )
        public
    {
        require(0x0 != _lrcTokenAddress);
        require(0x0 != _tokenRegistryAddress);
        require(0x0 != _ringhashRegistryAddress);
        require(0x0 != _delegateAddress);
        require(0x0 != _nameRegistryAddress);

        require(_maxRingSize > 1);
        require(_rateRatioCVSThreshold > 0);
        require(_walletSplitPercentage > 0);

        lrcTokenAddress = _lrcTokenAddress;
        tokenRegistryAddress = _tokenRegistryAddress;
        ringhashRegistryAddress = _ringhashRegistryAddress;
        delegateAddress = _delegateAddress;
        nameRegistryAddress = _nameRegistryAddress;
        maxRingSize = _maxRingSize;
        rateRatioCVSThreshold = _rateRatioCVSThreshold;
        walletSplitPercentage = _walletSplitPercentage;
    }

    ////////////////////////////////////////////////////////////////////////////
    /// Public Functions                                                     ///
    ////////////////////////////////////////////////////////////////////////////

    /// @dev Disable default function.
    function () payable public {
        revert();
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
        external
    {
        uint cancelAmount = orderValues[6];

        require(cancelAmount > 0); // "amount to cancel is zero");

        Order memory order = Order(
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

        cancelled[orderHash] = cancelled[orderHash].add(cancelAmount);
        cancelledOrFilled[orderHash] = cancelledOrFilled[orderHash].add(cancelAmount);

        OrderCancelled(orderHash, cancelAmount);
    }

    /// @dev   Set a cutoff timestamp to invalidate all orders whose timestamp
    ///        is smaller than or equal to the new value of the address's cutoff
    ///        timestamp, for a specific trading pair.
    /// @param cutoff The cutoff timestamp, will default to `block.timestamp`
    ///        if it is 0.
    function cancelAllOrdersByTradingPair(
        address token1,
        address token2,
        uint cutoff)
        external
    {
        uint t = (cutoff == 0 || cutoff >= block.timestamp) ? block.timestamp : cutoff;

        bytes20 tokenPair = bytes20(token1) ^ bytes20(token2);
        require(tradingPairCutoffs[msg.sender][tokenPair] < t); // "attempted to set cutoff to a smaller value"

        tradingPairCutoffs[msg.sender][tokenPair] = t;
        TradingPairCutoffTimestampChanged(
            msg.sender,
            token1,
            token2,
            t
        );
    }

    /// @dev   Set a cutoff timestamp to invalidate all orders whose timestamp
    ///        is smaller than or equal to the new value of the address's cutoff
    ///        timestamp.
    /// @param cutoff The cutoff timestamp, will default to `block.timestamp`
    ///        if it is 0.
    function cancelAllOrders(uint cutoff)
        external
    {
        uint t = (cutoff == 0 || cutoff >= block.timestamp) ? block.timestamp : cutoff;

        require(cutoffs[msg.sender] < t); // "attempted to set cutoff to a smaller value"

        cutoffs[msg.sender] = t;
        CutoffTimestampChanged(msg.sender, t);
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
    /// @param minerId      The address set that miner registered in NameRegistry.
    ///                        The address set contains a signer address and a fee
    ///                        recipient address.
    ///                        The signer address is used for sign this tx.
    ///                        The Recipient address for fee collection. If this is
    ///                        '0x0', all fees will be paid to the address who had
    ///                        signed this transaction, not `msg.sender`. Noted if
    ///                        LRC need to be paid back to order owner as the result
    ///                        of fee selection model, LRC will also be sent from
    ///                        this address.
    function submitRing(
        address[2][]  addressList,
        uint[7][]     uintArgsList,
        uint8[2][]    uint8ArgsList,
        bool[]        buyNoMoreThanAmountBList,
        uint8[]       vList,
        bytes32[]     rList,
        bytes32[]     sList,
        uint32        minerId
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

        verifyTokensRegistered(ringSize, addressList);

        var (feeRecipient, ringminer) = NameRegistry(nameRegistryAddress)
            .getParticipantById(minerId);

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

        //Assemble input data into structs so we can pass them to other functions.
        OrderState[] memory orders = assembleOrders(
            addressList,
            uintArgsList,
            uint8ArgsList,
            buyNoMoreThanAmountBList,
            vList,
            rList,
            sList
        );

        if (feeRecipient == 0x0) {
            feeRecipient = ringminer;
        }

        handleRing(
            ringSize,
            ringhash,
            orders,
            ringminer,
            feeRecipient,
            ringhashAttributes[1]
        );

        ringIndex = (ringIndex ^ ENTERED_MASK) + 1;
    }

    ////////////////////////////////////////////////////////////////////////////
    /// Internal & Private Functions                                         ///
    ////////////////////////////////////////////////////////////////////////////

    /// @dev Validate a ring.
    function verifyRingHasNoSubRing(
        uint          ringSize,
        OrderState[]  orders
        )
        private
        pure
    {
        // Check the ring has no sub-ring.
        for (uint i = 0; i < ringSize - 1; i++) {
            address tokenS = orders[i].order.tokenS;
            for (uint j = i + 1; j < ringSize; j++) {
                require(tokenS != orders[j].order.tokenS); // "found sub-ring");
            }
        }
    }

    function verifyTokensRegistered(
        uint          ringSize,
        address[2][]  addressList
        )
        private
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
        uint          ringSize,
        bytes32       ringhash,
        OrderState[]  orders,
        address       miner,
        address       feeRecipient,
        bool          isRinghashReserved
        )
        private
    {
        uint64 _ringIndex = ringIndex ^ ENTERED_MASK;
        address _lrcTokenAddress = lrcTokenAddress;
        TokenTransferDelegate delegate = TokenTransferDelegate(delegateAddress);

        // Do the hard work.
        verifyRingHasNoSubRing(ringSize, orders);

        // Exchange rates calculation are performed by ring-miners as solidity
        // cannot get power-of-1/n operation, therefore we have to verify
        // these rates are correct.
        verifyMinerSuppliedFillRates(ringSize, orders);

        // Scale down each order independently by substracting amount-filled and
        // amount-cancelled. Order owner's current balance and allowance are
        // not taken into consideration in these operations.
        scaleRingBasedOnHistoricalRecords(delegate, ringSize, orders);

        // Based on the already verified exchange rate provided by ring-miners,
        // we can furthur scale down orders based on token balance and allowance,
        // then find the smallest order of the ring, then calculate each order's
        // `fillAmountS`.
        calculateRingFillAmount(ringSize, orders);

        // Calculate each order's `lrcFee` and `lrcRewrard` and splict how much
        // of `fillAmountS` shall be paid to matching order or miner as margin
        // split.
        calculateRingFees(
            delegate,
            ringSize,
            orders,
            feeRecipient,
            _lrcTokenAddress
        );

        /// Make transfers.
        var (orderHashList, amountsList) = settleRing(
            delegate,
            ringSize,
            orders,
            feeRecipient,
            _lrcTokenAddress
        );

        RingMined(
            _ringIndex,
            ringhash,
            miner,
            feeRecipient,
            isRinghashReserved,
            orderHashList,
            amountsList
        );
    }

    function settleRing(
        TokenTransferDelegate delegate,
        uint          ringSize,
        OrderState[]  orders,
        address       feeRecipient,
        address       _lrcTokenAddress
        )
        private
        returns(
        bytes32[] memory orderHashList,
        uint[6][] memory amountsList)
    {
        bytes32[] memory batch = new bytes32[](ringSize * 6); // ringSize * (owner + tokenS + 4 amounts)
        orderHashList = new bytes32[](ringSize);
        amountsList = new uint[6][](ringSize);

        uint p = 0;
        for (uint i = 0; i < ringSize; i++) {
            OrderState memory state = orders[i];
            Order memory order = state.order;
            uint prevSplitB = orders[(i + ringSize - 1) % ringSize].splitB;
            uint nextFillAmountS = orders[(i + 1) % ringSize].fillAmountS;

            // Store owner and tokenS of every order
            batch[p] = bytes32(order.owner);
            batch[p+1] = bytes32(order.tokenS);

            // Store all amounts
            batch[p+2] = bytes32(state.fillAmountS - prevSplitB);
            batch[p+3] = bytes32(prevSplitB + state.splitS);
            batch[p+4] = bytes32(state.lrcReward);
            batch[p+5] = bytes32(state.lrcFee);
            p += 6;

            // Update fill records
            if (order.buyNoMoreThanAmountB) {
                cancelledOrFilled[state.orderHash] += nextFillAmountS;
            } else {
                cancelledOrFilled[state.orderHash] += state.fillAmountS;
            }

            orderHashList[i] = state.orderHash;
            amountsList[i][0] = state.fillAmountS + state.splitS;
            amountsList[i][1] = nextFillAmountS - state.splitB;
            amountsList[i][2] = state.lrcReward;
            amountsList[i][3] = state.lrcFee;
            amountsList[i][4] = state.splitS;
            amountsList[i][5] = state.splitB;
        }

        // Do all transactions
        delegate.batchTransferToken(_lrcTokenAddress, feeRecipient, batch);
    }

    /// @dev Verify miner has calculte the rates correctly.
    function verifyMinerSuppliedFillRates(
        uint          ringSize,
        OrderState[]  orders
        )
        private
        view
    {
        uint[] memory rateRatios = new uint[](ringSize);
        uint _rateRatioScale = RATE_RATIO_SCALE;

        for (uint i = 0; i < ringSize; i++) {
            uint s1b0 = orders[i].rate.amountS.mul(orders[i].order.amountB);
            uint s0b1 = orders[i].order.amountS.mul(orders[i].rate.amountB);

            require(s1b0 <= s0b1); // "miner supplied exchange rate provides invalid discount");

            rateRatios[i] = _rateRatioScale.mul(s1b0) / s0b1;
        }

        uint cvs = MathUint.cvsquare(rateRatios, _rateRatioScale);

        require(cvs <= rateRatioCVSThreshold); // "miner supplied exchange rate is not evenly discounted");
    }

    /// @dev Calculate each order's fee or LRC reward.
    function calculateRingFees(
        TokenTransferDelegate delegate,
        uint            ringSize,
        OrderState[]    orders,
        address         feeRecipient,
        address         _lrcTokenAddress
        )
        private
        view
    {
        bool checkedMinerLrcSpendable = false;
        uint minerLrcSpendable = 0;
        uint8 _marginSplitPercentageBase = MARGIN_SPLIT_PERCENTAGE_BASE;
        uint nextFillAmountS;

        for (uint i = 0; i < ringSize; i++) {
            OrderState memory state = orders[i];
            uint lrcReceiable = 0;

            if (state.lrcFee == 0) {
                // When an order's LRC fee is 0 or smaller than the specified fee,
                // we help miner automatically select margin-split.
                state.feeSelection = FEE_SELECT_MARGIN_SPLIT;
                state.order.marginSplitPercentage = _marginSplitPercentageBase;
            } else {
                uint lrcSpendable = getSpendable(
                    delegate,
                    _lrcTokenAddress,
                    state.order.owner
                );

                // If the order is selling LRC, we need to calculate how much LRC
                // is left that can be used as fee.
                if (state.order.tokenS == _lrcTokenAddress) {
                    lrcSpendable -= state.fillAmountS;
                }

                // If the order is buyign LRC, it will has more to pay as fee.
                if (state.order.tokenB == _lrcTokenAddress) {
                    nextFillAmountS = orders[(i + 1) % ringSize].fillAmountS;
                    lrcReceiable = nextFillAmountS;
                }

                uint lrcTotal = lrcSpendable + lrcReceiable;

                // If order doesn't have enough LRC, set margin split to 100%.
                if (lrcTotal < state.lrcFee) {
                    state.lrcFee = lrcTotal;
                    state.order.marginSplitPercentage = _marginSplitPercentageBase;
                }

                if (state.lrcFee == 0) {
                    state.feeSelection = FEE_SELECT_MARGIN_SPLIT;
                }
            }

            if (state.feeSelection == FEE_SELECT_LRC) {
                if (lrcReceiable > 0) {
                    if (lrcReceiable >= state.lrcFee) {
                        state.splitB = state.lrcFee;
                        state.lrcFee = 0;
                    } else {
                        state.splitB = lrcReceiable;
                        state.lrcFee -= lrcReceiable;
                    }
                }
            } else if (state.feeSelection == FEE_SELECT_MARGIN_SPLIT) {

                // Only check the available miner balance when absolutely needed
                if (!checkedMinerLrcSpendable && minerLrcSpendable < state.lrcFee) {
                    checkedMinerLrcSpendable = true;
                    minerLrcSpendable = getSpendable(delegate, _lrcTokenAddress, feeRecipient);
                }

                // Only calculate split when miner has enough LRC;
                // otherwise all splits are 0.
                if (minerLrcSpendable >= state.lrcFee) {
                    nextFillAmountS = orders[(i + 1) % ringSize].fillAmountS;
                    uint split;
                    if (state.order.buyNoMoreThanAmountB) {
                        split = (nextFillAmountS.mul(
                            state.order.amountS
                        ) / state.order.amountB).sub(
                            state.fillAmountS
                        );
                    } else {
                        split = nextFillAmountS.sub(
                            state.fillAmountS.mul(
                                state.order.amountB
                            ) / state.order.amountS
                        );
                    }

                    if (state.order.marginSplitPercentage != _marginSplitPercentageBase) {
                        split = split.mul(
                            state.order.marginSplitPercentage
                        ) / _marginSplitPercentageBase;
                    }

                    if (state.order.buyNoMoreThanAmountB) {
                        state.splitS = split;
                    } else {
                        state.splitB = split;
                    }

                    // This implicits order with smaller index in the ring will
                    // be paid LRC reward first, so the orders in the ring does
                    // mater.
                    if (split > 0) {
                        minerLrcSpendable -= state.lrcFee;
                        state.lrcReward = state.lrcFee;
                    }
                }

                state.lrcFee = 0;
            } else {
                revert(); // "unsupported fee selection value");
            }
        }
    }

    /// @dev Calculate each order's fill amount.
    function calculateRingFillAmount(
        uint          ringSize,
        OrderState[]  orders
        )
        private
        pure
    {
        uint smallestIdx = 0;
        uint i;
        uint j;

        for (i = 0; i < ringSize; i++) {
            j = (i + 1) % ringSize;
            smallestIdx = calculateOrderFillAmount(
                orders[i],
                orders[j],
                i,
                j,
                smallestIdx
            );
        }

        for (i = 0; i < smallestIdx; i++) {
            calculateOrderFillAmount(
                orders[i],
                orders[(i + 1) % ringSize],
                0,               // Not needed
                0,               // Not needed
                0                // Not needed
            );
        }
    }

    /// @return The smallest order's index.
    function calculateOrderFillAmount(
        OrderState        state,
        OrderState        next,
        uint              i,
        uint              j,
        uint              smallestIdx
        )
        private
        pure
        returns (uint newSmallestIdx)
    {
        // Default to the same smallest index
        newSmallestIdx = smallestIdx;

        uint fillAmountB = state.fillAmountS.mul(
            state.rate.amountB
        ) / state.rate.amountS;

        if (state.order.buyNoMoreThanAmountB) {
            if (fillAmountB > state.order.amountB) {
                fillAmountB = state.order.amountB;

                state.fillAmountS = fillAmountB.mul(
                    state.rate.amountS
                ) / state.rate.amountB;

                newSmallestIdx = i;
            }
            state.lrcFee = state.order.lrcFee.mul(
                fillAmountB
            ) / state.order.amountB;
        } else {
            state.lrcFee = state.order.lrcFee.mul(
                state.fillAmountS
            ) / state.order.amountS;
        }

        if (fillAmountB <= next.fillAmountS) {
            next.fillAmountS = fillAmountB;
        } else {
            newSmallestIdx = j;
        }
    }

    /// @dev Scale down all orders based on historical fill or cancellation
    ///      stats but key the order's original exchange rate.
    function scaleRingBasedOnHistoricalRecords(
        TokenTransferDelegate delegate,
        uint ringSize,
        OrderState[] orders
        )
        private
        view
    {
        for (uint i = 0; i < ringSize; i++) {
            OrderState memory state = orders[i];
            Order memory order = state.order;
            uint amount;

            if (order.buyNoMoreThanAmountB) {
                amount = order.amountB.tolerantSub(
                    cancelledOrFilled[state.orderHash]
                );

                order.amountS = amount.mul(order.amountS) / order.amountB;
                order.lrcFee = amount.mul(order.lrcFee) / order.amountB;

                order.amountB = amount;
            } else {
                amount = order.amountS.tolerantSub(
                    cancelledOrFilled[state.orderHash]
                );

                order.amountB = amount.mul(order.amountB) / order.amountS;
                order.lrcFee = amount.mul(order.lrcFee) / order.amountS;

                order.amountS = amount;
            }

            require(order.amountS > 0); // "amountS is zero");
            require(order.amountB > 0); // "amountB is zero");

            uint availableAmountS = getSpendable(delegate, order.tokenS, order.owner);
            require(availableAmountS > 0); // "order spendable amountS is zero");

            state.fillAmountS = (
                order.amountS < availableAmountS ?
                order.amountS : availableAmountS
            );
        }
    }

    /// @return Amount of ERC20 token that can be spent by this contract.
    function getSpendable(
        TokenTransferDelegate delegate,
        address tokenAddress,
        address tokenOwner
        )
        private
        view
        returns (uint)
    {
        ERC20 token = ERC20(tokenAddress);
        uint allowance = token.allowance(
            tokenOwner,
            address(delegate)
        );
        uint balance = token.balanceOf(tokenOwner);
        return (allowance < balance ? allowance : balance);
    }

    /// @dev verify input data's basic integrity.
    function verifyInputDataIntegrity(
        uint          ringSize,
        address[2][]  addressList,
        uint[7][]     uintArgsList,
        uint8[2][]    uint8ArgsList,
        bool[]        buyNoMoreThanAmountBList,
        uint8[]       vList,
        bytes32[]     rList,
        bytes32[]     sList
        )
        private
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
        private
        view
        returns (OrderState[] memory orders)
    {
        uint ringSize = addressList.length;
        orders = new OrderState[](ringSize);

        for (uint i = 0; i < ringSize; i++) {
            uint[7] memory uintArgs = uintArgsList[i];

            Order memory order = Order(
                addressList[i][0],
                addressList[i][1],
                addressList[(i + 1) % ringSize][1],
                uintArgs[0],
                uintArgs[1],
                uintArgs[5],
                buyNoMoreThanAmountBList[i],
                uint8ArgsList[i][0]
            );

            bytes32 orderHash = calculateOrderHash(
                order,
                uintArgs[2], // timestamp
                uintArgs[3], // ttl
                uintArgs[4]  // salt
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
                uintArgs[2], // timestamp
                uintArgs[3], // ttl
                uintArgs[4]  // salt
            );

            orders[i] = OrderState(
                order,
                orderHash,
                uint8ArgsList[i][1],  // feeSelection
                Rate(uintArgs[6], order.amountB),
                0,   // fillAmountS
                0,   // lrcReward
                0,   // lrcFee
                0,   // splitS
                0    // splitB
            );
        }
    }

    /// @dev validate order's parameters are OK.
    function validateOrder(
        Order        order,
        uint         timestamp,
        uint         ttl,
        uint         salt
        )
        private
        view
    {
        require(order.owner != 0x0); // "invalid order owner");
        require(order.tokenS != 0x0); // "invalid order tokenS");
        require(order.tokenB != 0x0); // "invalid order tokenB");
        require(order.amountS != 0); // "invalid order amountS");
        require(order.amountB != 0); // "invalid order amountB");
        require(timestamp <= block.timestamp); // "order is too early to match");

        require(ttl != 0); // "order ttl is 0");
        require(timestamp + ttl > block.timestamp); // "order is expired");
        require(salt != 0); // "invalid order salt");
        require(order.marginSplitPercentage <= MARGIN_SPLIT_PERCENTAGE_BASE); // "invalid order marginSplitPercentage");

        bytes20 tradingPair = bytes20(order.tokenS) ^ bytes20(order.tokenB);
        require(timestamp > tradingPairCutoffs[order.owner][tradingPair]); // "order trading pair is cut off");
        require(timestamp > cutoffs[order.owner]); // "order is cut off");
    }

    /// @dev Get the Keccak-256 hash of order with specified parameters.
    function calculateOrderHash(
        Order        order,
        uint         timestamp,
        uint         ttl,
        uint         salt
        )
        private
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
        bytes32 s
        )
        private
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

    function getTradingPairCutoffs(address token1, address token2)
        public
        view
        returns (uint)
    {
        bytes20 tokenPair = bytes20(token1) ^ bytes20(token2);
        return tradingPairCutoffs[msg.sender][tokenPair];
    }

}
