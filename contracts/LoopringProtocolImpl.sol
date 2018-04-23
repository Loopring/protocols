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
pragma solidity 0.4.21;

import "./lib/AddressUtil.sol";
import "./lib/ERC20.sol";
import "./lib/MathUint.sol";
import "./LoopringProtocol.sol";
import "./TokenRegistry.sol";
import "./TokenTransferDelegate.sol";


/// @title An Implementation of LoopringProtocol.
/// @author Daniel Wang - <daniel@loopring.org>,
/// @author Kongliang Zhong - <kongliang@loopring.org>
///
/// Recognized contributing developers from the community:
///     https://github.com/Brechtpd
///     https://github.com/rainydio
///     https://github.com/BenjaminPrice
///     https://github.com/jonasshen
///     https://github.com/Hephyrius
contract LoopringProtocolImpl is LoopringProtocol {
    using AddressUtil   for address;
    using MathUint      for uint;

    address public  lrcTokenAddress             = 0x0;
    address public  tokenRegistryAddress        = 0x0;
    address public  delegateAddress             = 0x0;

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
    uint    public rateRatioCVSThreshold        = 0;

    uint    public constant MAX_RING_SIZE       = 16;

    uint    public constant RATE_RATIO_SCALE    = 10000;

    /// @param orderHash    The order's hash
    /// @param feeSelection -
    ///                     A miner-supplied value indicating if LRC (value = 0)
    ///                     or margin split is choosen by the miner (value = 1).
    ///                     We may support more fee model in the future.
    /// @param rateS        Sell Exchange rate provided by miner.
    /// @param rateB        Buy Exchange rate provided by miner.
    /// @param fillAmountS  Amount of tokenS to sell, calculated by protocol.
    /// @param lrcReward    The amount of LRC paid by miner to order owner in
    ///                     exchange for margin split.
    /// @param lrcFeeState  The amount of LR paid by order owner to miner.
    /// @param splitS      TokenS paid to miner.
    /// @param splitB      TokenB paid to miner.
    struct OrderState {
        address owner;
        address tokenS;
        address tokenB;
        address wallet;
        address authAddr;
        uint    validSince;
        uint    validUntil;
        uint    amountS;
        uint    amountB;
        uint    lrcFee;
        bool    buyNoMoreThanAmountB;
        bool    marginSplitAsFee;
        bytes32 orderHash;
        uint8   marginSplitPercentage;
        uint    rateS;
        uint    rateB;
        uint    fillAmountS;
        uint    lrcReward;
        uint    lrcFeeState;
        uint    splitS;
        uint    splitB;
    }

    /// @dev A struct to capture parameters passed to submitRing method and
    ///      various of other variables used across the submitRing core logics.
    struct RingParams {
        uint8[]       vList;
        bytes32[]     rList;
        bytes32[]     sList;
        address       miner;
        uint16        feeSelections;
        uint          ringSize;         // computed
        bytes32       ringHash;         // computed
    }

    function LoopringProtocolImpl(
        address _lrcTokenAddress,
        address _tokenRegistryAddress,
        address _delegateAddress,
        uint    _rateRatioCVSThreshold,
        uint8   _walletSplitPercentage
        )
        public
    {
        require(_lrcTokenAddress.isContract());
        require(_tokenRegistryAddress.isContract());
        require(_delegateAddress.isContract());

        require(_rateRatioCVSThreshold > 0);
        require(_walletSplitPercentage > 0 && _walletSplitPercentage < 100);

        lrcTokenAddress = _lrcTokenAddress;
        tokenRegistryAddress = _tokenRegistryAddress;
        delegateAddress = _delegateAddress;
        rateRatioCVSThreshold = _rateRatioCVSThreshold;
        walletSplitPercentage = _walletSplitPercentage;
    }

    /// @dev Disable default function.
    function ()
        payable
        public
    {
        revert();
    }

    function cancelOrder(
        address[5] addresses,
        uint[6]    orderValues,
        bool       buyNoMoreThanAmountB,
        uint8      marginSplitPercentage,
        uint8      v,
        bytes32    r,
        bytes32    s
        )
        external
    {
        uint cancelAmount = orderValues[5];

        require(cancelAmount > 0); // "amount to cancel is zero");

        OrderState memory order = OrderState(
            addresses[0],
            addresses[1],
            addresses[2],
            addresses[3],
            addresses[4],
            orderValues[2],
            orderValues[3],
            orderValues[0],
            orderValues[1],
            orderValues[4],
            buyNoMoreThanAmountB,
            false,
            0x0,
            marginSplitPercentage,
            0,
            0,
            0,
            0,
            0,
            0,
            0
        );

        require(msg.sender == order.owner); // "cancelOrder not submitted by order owner");

        bytes32 orderHash = calculateOrderHash(order);

        verifySignature(
            order.owner,
            orderHash,
            v,
            r,
            s
        );

        TokenTransferDelegate delegate = TokenTransferDelegate(delegateAddress);
        delegate.addCancelled(orderHash, cancelAmount);
        delegate.addCancelledOrFilled(orderHash, cancelAmount);

        emit OrderCancelled(orderHash, cancelAmount);
    }

    function cancelAllOrdersByTradingPair(
        address token1,
        address token2,
        uint    cutoff
        )
        external
    {
        uint t = (cutoff == 0 || cutoff >= block.timestamp) ? block.timestamp : cutoff;

        bytes20 tokenPair = bytes20(token1) ^ bytes20(token2);
        TokenTransferDelegate delegate = TokenTransferDelegate(delegateAddress);

        require(delegate.tradingPairCutoffs(msg.sender, tokenPair) < t);
        // "attempted to set cutoff to a smaller value"

        delegate.setTradingPairCutoffs(tokenPair, t);
        emit OrdersCancelled(
            msg.sender,
            token1,
            token2,
            t
        );
    }

    function cancelAllOrders(
        uint cutoff
        )
        external
    {
        uint t = (cutoff == 0 || cutoff >= block.timestamp) ? block.timestamp : cutoff;
        TokenTransferDelegate delegate = TokenTransferDelegate(delegateAddress);

        require(delegate.cutoffs(msg.sender) < t); // "attempted to set cutoff to a smaller value"

        delegate.setCutoffs(t);
        emit AllOrdersCancelled(msg.sender, t);
    }

    function submitRing(
        address[4][]  addressList,
        uint[6][]     uintArgsList,
        uint8[1][]    uint8ArgsList,
        bool[]        buyNoMoreThanAmountBList,
        uint8[]       vList,
        bytes32[]     rList,
        bytes32[]     sList,
        address       miner,
        uint16        feeSelections
        )
        public
    {
        // Check if the highest bit of ringIndex is '1'.
        require((ringIndex >> 63) == 0); // "attempted to re-ent submitRing function");

        // Set the highest bit of ringIndex to '1'.
        uint64 _ringIndex = ringIndex;
        ringIndex |= (1 << 63);

        RingParams memory params = RingParams(
            vList,
            rList,
            sList,
            miner,
            feeSelections,
            addressList.length,
            0x0 // ringHash
        );

        verifyInputDataIntegrity(
            params,
            addressList,
            uintArgsList,
            uint8ArgsList,
            buyNoMoreThanAmountBList
        );


        // Assemble input data into structs so we can pass them to other functions.
        // This method also calculates ringHash, therefore it must be called before
        // calling `verifyRingSignatures`.
        TokenTransferDelegate delegate = TokenTransferDelegate(delegateAddress);
        OrderState[] memory orders = assembleOrders(
            params,
            delegate,
            addressList,
            uintArgsList,
            uint8ArgsList,
            buyNoMoreThanAmountBList
        );

        verifyRingSignatures(params, orders);

        verifyTokensRegistered(params, orders);

        handleRing(_ringIndex, params, orders, delegate);

        ringIndex = _ringIndex + 1;
    }

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
            address tokenS = orders[i].tokenS;
            for (uint j = i + 1; j < ringSize; j++) {
                require(tokenS != orders[j].tokenS); // "found sub-ring");
            }
        }
    }

    /// @dev Verify the ringHash has been signed with each order's auth private
    ///      keys as well as the miner's private key.
    function verifyRingSignatures(
        RingParams params,
        OrderState[] orders
        )
        private
        pure
    {
        uint j;
        for (uint i = 0; i < params.ringSize; i++) {
            j = i + params.ringSize;

            verifySignature(
                orders[i].authAddr,
                params.ringHash,
                params.vList[j],
                params.rList[j],
                params.sList[j]
            );
        }
    }

    function verifyTokensRegistered(
        RingParams params,
        OrderState[] orders
        )
        private
        view
    {
        // Extract the token addresses
        address[] memory tokens = new address[](params.ringSize);
        for (uint i = 0; i < params.ringSize; i++) {
            tokens[i] = orders[i].tokenS;
        }

        // Test all token addresses at once
        require(
            TokenRegistry(tokenRegistryAddress).areAllTokensRegistered(tokens)
        ); // "token not registered");
    }

    function handleRing(
        uint64       _ringIndex,
        RingParams   params,
        OrderState[] orders,
        TokenTransferDelegate delegate
        )
        private
    {
        address _lrcTokenAddress = lrcTokenAddress;

        // Do the hard work.
        verifyRingHasNoSubRing(params.ringSize, orders);

        // Exchange rates calculation are performed by ring-miners as solidity
        // cannot get power-of-1/n operation, therefore we have to verify
        // these rates are correct.
        verifyMinerSuppliedFillRates(params.ringSize, orders);

        // Scale down each order independently by substracting amount-filled and
        // amount-cancelled. Order owner's current balance and allowance are
        // not taken into consideration in these operations.
        scaleRingBasedOnHistoricalRecords(delegate, params.ringSize, orders);

        // Based on the already verified exchange rate provided by ring-miners,
        // we can furthur scale down orders based on token balance and allowance,
        // then find the smallest order of the ring, then calculate each order's
        // `fillAmountS`.
        calculateRingFillAmount(params.ringSize, orders);

        // Calculate each order's `lrcFee` and `lrcRewrard` and splict how much
        // of `fillAmountS` shall be paid to matching order or miner as margin
        // split.

        calculateRingFees(
            delegate,
            params.ringSize,
            orders,
            params.miner,
            _lrcTokenAddress
        );

        /// Make transfers.
        uint[] memory orderInfoList = settleRing(
            delegate,
            params.ringSize,
            orders,
            params.miner,
            _lrcTokenAddress
        );

        emit RingMined(
            _ringIndex,
            params.ringHash,
            params.miner,
            orderInfoList
        );
    }

    function settleRing(
        TokenTransferDelegate delegate,
        uint          ringSize,
        OrderState[]  orders,
        address       miner,
        address       _lrcTokenAddress
        )
        private
        returns (uint[] memory orderInfoList)
    {
        bytes32[] memory batch = new bytes32[](ringSize * 7); // ringSize * (owner + tokenS + 4 amounts + wallet)
        bytes32[] memory historyBatch = new bytes32[](ringSize * 2); // ringSize * (orderhash, fillAmount)
        orderInfoList = new uint[](ringSize * 6);

        uint p = 0;
        uint q = 0;
        uint r = 0;
        uint prevSplitB = orders[ringSize - 1].splitB;
        for (uint i = 0; i < ringSize; i++) {
            OrderState memory state = orders[i];
            uint nextFillAmountS = orders[(i + 1) % ringSize].fillAmountS;

            // Store owner and tokenS of every order
            batch[p++] = bytes32(state.owner);
            batch[p++] = bytes32(state.tokenS);

            // Store all amounts
            batch[p++] = bytes32(state.fillAmountS.sub(prevSplitB));
            batch[p++] = bytes32(prevSplitB.add(state.splitS));
            batch[p++] = bytes32(state.lrcReward);
            batch[p++] = bytes32(state.lrcFeeState);
            batch[p++] = bytes32(state.wallet);

            historyBatch[r++] = state.orderHash;
            historyBatch[r++] = bytes32(state.buyNoMoreThanAmountB ?
                nextFillAmountS : state.fillAmountS);

            orderInfoList[q++] = uint(state.orderHash);
            orderInfoList[q++] = state.fillAmountS;
            orderInfoList[q++] = state.lrcReward;
            orderInfoList[q++] = state.lrcFeeState;
            orderInfoList[q++] = state.splitS;
            orderInfoList[q++] = state.splitB;

            prevSplitB = state.splitB;
        }
        // Update fill records
        delegate.batchAddCancelledOrFilled(historyBatch);

        // Do all transactions
        delegate.batchTransferToken(
            _lrcTokenAddress,
            miner,
            walletSplitPercentage,
            batch
        );
    }

    /// @dev Verify miner has calculte the rates correctly.
    function verifyMinerSuppliedFillRates(
        uint         ringSize,
        OrderState[] orders
        )
        private
        view
    {
        uint[] memory rateRatios = new uint[](ringSize);
        uint _rateRatioScale = RATE_RATIO_SCALE;

        for (uint i = 0; i < ringSize; i++) {
            uint s1b0 = orders[i].rateS.mul(orders[i].amountB);
            uint s0b1 = orders[i].amountS.mul(orders[i].rateB);

            require(s1b0 <= s0b1); // "miner supplied exchange rate provides invalid discount");

            rateRatios[i] = _rateRatioScale.mul(s1b0) / s0b1;
        }

        uint cvs = MathUint.cvsquare(rateRatios, _rateRatioScale);

        require(cvs <= rateRatioCVSThreshold);
        // "miner supplied exchange rate is not evenly discounted");
    }

    /// @dev Calculate each order's fee or LRC reward.
    function calculateRingFees(
        TokenTransferDelegate delegate,
        uint            ringSize,
        OrderState[]    orders,
        address         miner,
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

            if (state.lrcFeeState == 0) {
                // When an order's LRC fee is 0 or smaller than the specified fee,
                // we help miner automatically select margin-split.
                state.marginSplitAsFee = true;
                state.marginSplitPercentage = _marginSplitPercentageBase;
            } else {
                uint lrcSpendable = getSpendable(
                    delegate,
                    _lrcTokenAddress,
                    state.owner
                );

                // If the order is selling LRC, we need to calculate how much LRC
                // is left that can be used as fee.
                if (state.tokenS == _lrcTokenAddress) {
                    lrcSpendable = lrcSpendable.sub(state.fillAmountS);
                }

                // If the order is buyign LRC, it will has more to pay as fee.
                if (state.tokenB == _lrcTokenAddress) {
                    nextFillAmountS = orders[(i + 1) % ringSize].fillAmountS;
                    lrcReceiable = nextFillAmountS;
                }

                uint lrcTotal = lrcSpendable.add(lrcReceiable);

                // If order doesn't have enough LRC, set margin split to 100%.
                if (lrcTotal < state.lrcFeeState) {
                    state.lrcFeeState = lrcTotal;
                    state.marginSplitPercentage = _marginSplitPercentageBase;
                }

                if (state.lrcFeeState == 0) {
                    state.marginSplitAsFee = true;
                }
            }

            if (!state.marginSplitAsFee) {
                if (lrcReceiable > 0) {
                    if (lrcReceiable >= state.lrcFeeState) {
                        state.splitB = state.lrcFeeState;
                        state.lrcFeeState = 0;
                    } else {
                        state.splitB = lrcReceiable;
                        state.lrcFeeState = state.lrcFeeState.sub(lrcReceiable);
                    }
                }
            } else {

                // Only check the available miner balance when absolutely needed
                if (!checkedMinerLrcSpendable && minerLrcSpendable < state.lrcFeeState) {
                    checkedMinerLrcSpendable = true;
                    minerLrcSpendable = getSpendable(delegate, _lrcTokenAddress, miner);
                }

                // Only calculate split when miner has enough LRC;
                // otherwise all splits are 0.
                if (minerLrcSpendable >= state.lrcFeeState) {
                    nextFillAmountS = orders[(i + 1) % ringSize].fillAmountS;
                    uint split;
                    if (state.buyNoMoreThanAmountB) {
                        split = (nextFillAmountS.mul(
                            state.amountS
                        ) / state.amountB).sub(
                            state.fillAmountS
                        );
                    } else {
                        split = nextFillAmountS.sub(
                            state.fillAmountS.mul(
                                state.amountB
                            ) / state.amountS
                        );
                    }

                    if (state.marginSplitPercentage != _marginSplitPercentageBase) {
                        split = split.mul(
                            state.marginSplitPercentage
                        ) / _marginSplitPercentageBase;
                    }

                    if (state.buyNoMoreThanAmountB) {
                        state.splitS = split;
                    } else {
                        state.splitB = split;
                    }

                    // This implicits order with smaller index in the ring will
                    // be paid LRC reward first, so the orders in the ring does
                    // mater.
                    if (split > 0) {
                        minerLrcSpendable = minerLrcSpendable.sub(state.lrcFeeState);
                        state.lrcReward = state.lrcFeeState;
                    }
                }

                state.lrcFeeState = 0;
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
        OrderState state,
        OrderState next,
        uint       i,
        uint       j,
        uint       smallestIdx
        )
        private
        pure
        returns (uint newSmallestIdx)
    {
        // Default to the same smallest index
        newSmallestIdx = smallestIdx;

        uint fillAmountB = state.fillAmountS.mul(
            state.rateB
        ) / state.rateS;

        if (state.buyNoMoreThanAmountB) {
            if (fillAmountB > state.amountB) {
                fillAmountB = state.amountB;

                state.fillAmountS = fillAmountB.mul(
                    state.rateS
                ) / state.rateB;

                newSmallestIdx = i;
            }
            state.lrcFeeState = state.lrcFee.mul(
                fillAmountB
            ) / state.amountB;
        } else {
            state.lrcFeeState = state.lrcFee.mul(
                state.fillAmountS
            ) / state.amountS;
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
            uint amount;

            if (state.buyNoMoreThanAmountB) {
                amount = state.amountB.tolerantSub(
                    delegate.cancelledOrFilled(state.orderHash)
                );

                state.amountS = amount.mul(state.amountS) / state.amountB;
                state.lrcFee = amount.mul(state.lrcFee) / state.amountB;

                state.amountB = amount;
            } else {
                amount = state.amountS.tolerantSub(
                    delegate.cancelledOrFilled(state.orderHash)
                );

                state.amountB = amount.mul(state.amountB) / state.amountS;
                state.lrcFee = amount.mul(state.lrcFee) / state.amountS;

                state.amountS = amount;
            }

            require(state.amountS > 0); // "amountS is zero");
            require(state.amountB > 0); // "amountB is zero");

            uint availableAmountS = getSpendable(delegate, state.tokenS, state.owner);
            require(availableAmountS > 0); // "order spendable amountS is zero");

            state.fillAmountS = (
                state.amountS < availableAmountS ?
                state.amountS : availableAmountS
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
        RingParams params,
        address[4][]  addressList,
        uint[6][]     uintArgsList,
        uint8[1][]    uint8ArgsList,
        bool[]        buyNoMoreThanAmountBList
        )
        private
        pure
    {
        require(params.miner != 0x0);
        require(params.ringSize == addressList.length);
        require(params.ringSize == uintArgsList.length);
        require(params.ringSize == uint8ArgsList.length);
        require(params.ringSize == buyNoMoreThanAmountBList.length);

        // Validate ring-mining related arguments.
        for (uint i = 0; i < params.ringSize; i++) {
            require(uintArgsList[i][5] > 0); // "order rateAmountS is zero");
        }

        //Check ring size
        require(params.ringSize > 1 && params.ringSize <= MAX_RING_SIZE); // "invalid ring size");

        uint sigSize = params.ringSize << 1;
        require(sigSize == params.vList.length);
        require(sigSize == params.rList.length);
        require(sigSize == params.sList.length);
    }

    /// @dev        assmble order parameters into Order struct.
    /// @return     A list of orders.
    function assembleOrders(
        RingParams params,
        TokenTransferDelegate delegate,
        address[4][]  addressList,
        uint[6][]     uintArgsList,
        uint8[1][]    uint8ArgsList,
        bool[]        buyNoMoreThanAmountBList
        )
        private
        view
        returns (OrderState[] memory orders)
    {
        orders = new OrderState[](params.ringSize);

        for (uint i = 0; i < params.ringSize; i++) {
            uint[6] memory uintArgs = uintArgsList[i];
            bool marginSplitAsFee = (params.feeSelections & (uint16(1) << i)) > 0;
            orders[i] = OrderState(
                addressList[i][0],
                addressList[i][1],
                addressList[(i + 1) % params.ringSize][1],
                addressList[i][2],
                addressList[i][3],
                uintArgs[2],
                uintArgs[3],
                uintArgs[0],
                uintArgs[1],
                uintArgs[4],
                buyNoMoreThanAmountBList[i],
                marginSplitAsFee,
                bytes32(0),
                uint8ArgsList[i][0],
                uintArgs[5],
                uintArgs[1],
                0,   // fillAmountS
                0,   // lrcReward
                0,   // lrcFee
                0,   // splitS
                0    // splitB
            );

            validateOrder(orders[i]);

            bytes32 orderHash = calculateOrderHash(orders[i]);
            orders[i].orderHash = orderHash;

            verifySignature(
                orders[i].owner,
                orderHash,
                params.vList[i],
                params.rList[i],
                params.sList[i]
            );

            params.ringHash ^= orderHash;
        }

        validateOrdersCutoffs(orders, delegate);

        params.ringHash = keccak256(
            params.ringHash,
            params.miner,
            params.feeSelections
        );
    }

    /// @dev validate order's parameters are OK.
    function validateOrder(
        OrderState order
        )
        private
        view
    {
        require(order.owner != 0x0); // invalid order owner
        require(order.tokenS != 0x0); // invalid order tokenS
        require(order.tokenB != 0x0); // invalid order tokenB
        require(order.amountS != 0); // invalid order amountS
        require(order.amountB != 0); // invalid order amountB
        require(order.marginSplitPercentage <= MARGIN_SPLIT_PERCENTAGE_BASE);
        // invalid order marginSplitPercentage

        require(order.validSince <= block.timestamp); // order is too early to match
        require(order.validUntil > block.timestamp); // order is expired
    }

    function validateOrdersCutoffs(OrderState[] orders, TokenTransferDelegate delegate)
        private
        view
    {
        address[] memory owners = new address[](orders.length);
        bytes20[] memory tradingPairs = new bytes20[](orders.length);
        uint[] memory validSinceTimes = new uint[](orders.length);

        for (uint i = 0; i < orders.length; i++) {
            owners[i] = orders[i].owner;
            tradingPairs[i] = bytes20(orders[i].tokenS) ^ bytes20(orders[i].tokenB);
            validSinceTimes[i] = orders[i].validSince;
        }

        delegate.checkCutoffsBatch(owners, tradingPairs, validSinceTimes);
    }

    /// @dev Get the Keccak-256 hash of order with specified parameters.
    function calculateOrderHash(
        OrderState order
        )
        private
        view
        returns (bytes32)
    {
        return keccak256(
            delegateAddress,
            order.owner,
            order.tokenS,
            order.tokenB,
            order.wallet,
            order.authAddr,
            order.amountS,
            order.amountB,
            order.validSince,
            order.validUntil,
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

    function getTradingPairCutoffs(
        address orderOwner,
        address token1,
        address token2
        )
        public
        view
        returns (uint)
    {
        bytes20 tokenPair = bytes20(token1) ^ bytes20(token2);
        TokenTransferDelegate delegate = TokenTransferDelegate(delegateAddress);
        return delegate.tradingPairCutoffs(orderOwner, tokenPair);
    }
}
