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
import "./lib/MemoryUtil.sol";


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

    uint    public constant RING_HEADER_SIZE    = 23;

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
        // The following members are used directly to deserialize the call data
        // so any changes need to be synced with the call data layout
        // Start --
        address owner;
        address tokenS;
        address wallet;
        address authAddr;
        uint    amountS;
        uint    amountB;
        uint    lrcFee;
        uint    rateS;
        bytes32 r;
        bytes32 s;
        bytes32 ringR;
        bytes32 ringS;
        // -- End

        uint    validSince;
        uint    validUntil;
        uint8   v;
        uint8   ringV;
        bool    buyNoMoreThanAmountB;
        bool    marginSplitAsFee;
        uint8   marginSplitPercentage;

        uint    rateB;
        address tokenB;

        bytes32 orderHash;
        uint    fillAmountS;
        uint    lrcReward;
        uint    lrcFeeState;
        uint    splitS;
        uint    splitB;
    }

    /// @dev A struct to capture parameters passed to submitRing method and
    ///      various of other variables used across the submitRing core logics.
    struct RingParams {
        address       feeRecipient;
        uint16        feeSelections;
        uint          ringSize;
        bytes32       ringHash;         // computed
    }

    struct SettledOrderInfo {
        bytes32 orderHash;
        address owner;
        address tokenS;
        uint fillAmountS;
        int lrcRewardOrFee;
        int split;
    }

    /// constructor
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
            addresses[3],
            addresses[4],
            orderValues[0],
            orderValues[1],
            orderValues[4],
            0,
            0x0,
            0x0,
            0x0,
            0x0,
            orderValues[2],
            orderValues[3],
            0,
            0,
            buyNoMoreThanAmountB,
            false,
            marginSplitPercentage,
            0,
            addresses[2],
            0x0,
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
        bytes data
        )
        public
    {
        // Check if the highest bit of ringIndex is '1'.
        require((ringIndex >> 63) == 0); // "attempted to re-ent submitRing function");

        // Set the highest bit of ringIndex to '1'.
        uint64 _ringIndex = ringIndex;
        ringIndex |= (1 << 63);

        // Setup the ring parameters
        RingParams memory params = setupRingParams(data);

        // Assemble input data into structs so we can pass them to other functions.
        // This method also calculates ringHash, therefore it must be called before
        // calling `verifyRingSignatures`.
        TokenTransferDelegate delegate = TokenTransferDelegate(delegateAddress);
        OrderState[] memory orders = assembleOrders(
            params,
            data
        );

        verifyRingSignatures(params, orders);

        verifyTokensRegistered(params, orders);

        handleRing(_ringIndex, params, orders, delegate);

        ringIndex = _ringIndex + 1;
    }

    /// @dev extract the ring parameter values
    /// @return     The ring parameters
    function setupRingParams(
        bytes data
        )
        private
        pure
        returns (RingParams memory params)
    {
        // Read ring header from call data
        require(data.length >= RING_HEADER_SIZE);
        uint ringHeader = MemoryUtil.bytesToUint(data, 0);

        // Extract data from ring header
        params.ringSize = uint8(ringHeader >> 248);
        params.feeRecipient = address(ringHeader >> 88);
        params.feeSelections = uint16(ringHeader >> 72);

        require(params.feeRecipient != 0x0);
        require(params.ringSize > 1 && params.ringSize <= MAX_RING_SIZE); // "invalid ring size");

        return params;
    }

    /// @dev        assmble order parameters into Order struct.
    /// @return     A list of orders.
    function assembleOrders(
        RingParams params,
        bytes data
        )
        private
        view
        returns (OrderState[] memory orders)
    {
        uint offset = RING_HEADER_SIZE;
        uint orderSize = 395;

        // Validate the data size
        require(data.length == offset + orderSize * params.ringSize);

        orders = new OrderState[](params.ringSize);

        OrderState memory order;
        uint i;
        for (i = 0; i < params.ringSize; i++) {
            order = orders[i];

            // Read order data straight from the call data
            uint orderPtr;
            assembly {
                orderPtr := order
            }
            MemoryUtil.copyCallDataBytesInArray(0, orderPtr, offset, 384);
            uint packedData = MemoryUtil.bytesToUint(data, offset + 384);

            // Unpack data
            order.validSince = (packedData >> 224) & 0xFFFFFFFF;
            order.validUntil = ((packedData >> 192) & 0xFFFFFFFF) + order.validSince;
            order.v = uint8(packedData >> 184);
            order.ringV = uint8(packedData >> 176);
            order.buyNoMoreThanAmountB = (packedData >> 168) & 128 > 0;
            order.marginSplitPercentage = uint8((packedData >> 168) & 127);
            order.marginSplitAsFee = (params.feeSelections & (uint16(1) << i)) > 0;

            // Set members values that can be derived from other members
            order.rateB = order.amountB;

            offset += orderSize;
        }

        for (i = 0; i < params.ringSize; i++) {
            order = orders[i];

            // Get tokenB from the next order
            order.tokenB = orders[(i + 1) % params.ringSize].tokenS;

            // Reconstruct data using information from previous orders
            if (i > 0) {
                OrderState memory prevOrder = orders[i - 1];
                order.wallet = address(uint(prevOrder.wallet) ^ uint(order.wallet));
                order.authAddr = address(uint(prevOrder.authAddr) ^ uint(order.authAddr));
                order.ringR = prevOrder.ringR ^ order.ringR;
                order.ringS = prevOrder.ringS ^ order.ringS;
                order.ringV = prevOrder.ringV ^ order.ringV;
            }

            validateOrder(order);

            // Validate ring-mining related arguments.
            require(order.rateS > 0); // "order rateAmountS is zero");

            order.orderHash = calculateOrderHash(order);

            verifySignature(
                order.owner,
                order.orderHash,
                order.v,
                order.r,
                order.s
            );

            params.ringHash ^= order.orderHash;
        }

        params.ringHash = keccak256(
            params.ringHash,
            params.feeRecipient,
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

    /// @dev Verify the ringHash has been signed with each order's auth private
    ///      keys as well as the miner's private key.
    function verifyRingSignatures(
        RingParams params,
        OrderState[] orders
        )
        private
        pure
    {
        for (uint i = 0; i < params.ringSize; i++) {
            // Don't verify the signature again if it's the same as the previous order
            if(i > 0 &&
               orders[i].authAddr == orders[i - 1].authAddr &&
               orders[i].ringV == orders[i - 1].ringV &&
               orders[i].ringR == orders[i - 1].ringR &&
               orders[i].ringS == orders[i - 1].ringS) {
                continue;
            }
            verifySignature(
                orders[i].authAddr,
                params.ringHash,
                orders[i].ringV,
                orders[i].ringR,
                orders[i].ringS
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
            _lrcTokenAddress
        );

        /// Make transfers.
        bytes32[] memory orderInfoList = settleRing(
            delegate,
            params.ringSize,
            orders,
            params.feeRecipient,
            _lrcTokenAddress
        );

        emit RingMined(
            _ringIndex,
            params.ringHash,
            tx.origin,
            params.feeRecipient,
            orderInfoList
        );
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
        uint[3] memory cancelledOrFilledAmounts;
        for (uint i = 0; i < ringSize; i++) {
            OrderState memory state = orders[i];
            uint amount;

            if(i % 3 == 0) {
                cancelledOrFilledAmounts = delegate.getCancelledOrFilledBatch(
                    state.orderHash,
                    (i+1 < ringSize) ? orders[i+1].orderHash : bytes32(0),
                    (i+2 < ringSize) ? orders[i+2].orderHash : bytes32(0)
                );
            }

            if (state.buyNoMoreThanAmountB) {
                amount = state.amountB.tolerantSub(cancelledOrFilledAmounts[i % 3]);

                state.amountS = amount.mul(state.amountS) / state.amountB;
                state.lrcFee = amount.mul(state.lrcFee) / state.amountB;
                state.amountB = amount;

            } else {
                amount = state.amountS.tolerantSub(cancelledOrFilledAmounts[i % 3]);

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

            require(state.fillAmountS > 0);
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

                require(state.fillAmountS > 0);

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

    /// @dev Calculate each order's fee or LRC reward.
    function calculateRingFees(
        TokenTransferDelegate delegate,
        uint            ringSize,
        OrderState[]    orders,
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
                    minerLrcSpendable = getSpendable(delegate, _lrcTokenAddress, tx.origin);
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

    function settleRing(
        TokenTransferDelegate delegate,
        uint          ringSize,
        OrderState[]  orders,
        address       feeRecipient,
        address       _lrcTokenAddress
        )
        private
        returns (bytes32[] memory orderInfoList)
    {
        bytes32[] memory batch = new bytes32[](ringSize * 10); // ringSize * sizeof(TokenTransfer.OrderSettleData)
        orderInfoList = new bytes32[](ringSize * 6);           // ringSize * sizeof(SettledOrderInfo)

        TokenTransfer.OrderSettleData memory orderSettleData;
        SettledOrderInfo memory settledOrderInfo;
        uint prevSplitB = orders[ringSize - 1].splitB;
        for (uint i = 0; i < ringSize; i++) {
            OrderState memory state = orders[i];
            uint nextFillAmountS = orders[(i + 1) % ringSize].fillAmountS;

            // This will make writes to orderSettleData to be stored in the memory of batch
            uint ptr = MemoryUtil.getBytes32Pointer(batch, 10 * i);
            assembly {
                orderSettleData := ptr
            }
            orderSettleData.owner = state.owner;
            orderSettleData.tokenS = state.tokenS;
            orderSettleData.amount = state.fillAmountS.sub(prevSplitB);
            orderSettleData.split = prevSplitB.add(state.splitS);
            orderSettleData.lrcReward = state.lrcReward;
            orderSettleData.lrcFee = state.lrcFeeState;
            orderSettleData.wallet = state.wallet;
            orderSettleData.orderHash = state.orderHash;
            orderSettleData.fillAmount = state.buyNoMoreThanAmountB ? nextFillAmountS : state.fillAmountS;
            orderSettleData.validSince = state.validSince;

            // This will make writes to settledOrderInfo to be stored in the memory of orderInfoList
            ptr = MemoryUtil.getBytes32Pointer(orderInfoList, 6 * i);
            assembly {
                settledOrderInfo := ptr
            }
            settledOrderInfo.orderHash = state.orderHash;
            settledOrderInfo.owner = state.owner;
            settledOrderInfo.tokenS = state.tokenS;
            settledOrderInfo.fillAmountS = state.fillAmountS;
            settledOrderInfo.lrcRewardOrFee = state.lrcFeeState > 0 ? int(state.lrcFeeState) : -int(state.lrcReward);
            settledOrderInfo.split = state.splitS > 0 ? int(state.splitS) : -int(state.splitB);

            prevSplitB = state.splitB;
        }

        // Do all transactions
        delegate.batchUpdateHistoryAndTransferTokens(
            _lrcTokenAddress,
            tx.origin,
            feeRecipient,
            walletSplitPercentage,
            batch
        );
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
