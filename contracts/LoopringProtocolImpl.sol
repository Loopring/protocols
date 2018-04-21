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
pragma solidity 0.4.23;
pragma experimental "v0.5.0";
pragma experimental "ABIEncoderV2";

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
    struct Context {
        address[4][]  addressList;
        uint[6][]     uintArgsList;
        uint8[1][]    uint8ArgsList;
        bool[]        buyNoMoreThanAmountBList;
        uint8[]       vList;
        bytes32[]     rList;
        bytes32[]     sList;
        address       miner;
        uint16        feeSelections;
        uint64        ringIndex;
        uint          ringSize;         // computed
        TokenTransferDelegate delegate;
        OrderState[]  orders;
        bytes32       ringHash;         // computed
    }

    constructor(
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
        external
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

        require(cancelAmount > 0, "invalid cancelAmount");

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

        require(
            msg.sender == order.owner,
            "cancelOrder not submitted by owner"
        );

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

        require(
            delegate.tradingPairCutoffs(msg.sender, tokenPair) < t,
            "cutoff too small"
        );

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

        require(
            delegate.cutoffs(msg.sender) < t,
            "cutoff too small"
        );

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
        Context memory ctx = Context(
            addressList,
            uintArgsList,
            uint8ArgsList,
            buyNoMoreThanAmountBList,
            vList,
            rList,
            sList,
            miner,
            feeSelections,
            ringIndex,
            addressList.length,
            TokenTransferDelegate(delegateAddress),
            new OrderState[](addressList.length),
            0x0 // ringHash
        );

        // Check if the highest bit of ringIndex is '1'.
        require((ringIndex >> 63) == 0, "reentry");

        // Set the highest bit of ringIndex to '1'.
        ringIndex |= (1 << 63);

        verifyInputDataIntegrity(ctx);

        assembleOrders(ctx);

        validateOrdersCutoffs(ctx);

        verifyRingSignatures(ctx);

        verifyTokensRegistered(ctx);

        verifyRingHasNoSubRing(ctx);

        verifyMinerSuppliedFillRates(ctx);

        scaleRingBasedOnHistoricalRecords(ctx);

        calculateRingFillAmount(ctx);

        calculateRingFees(ctx);

        settleRing(ctx);

        ringIndex = ctx.ringIndex + 1;
    }

    /// @dev verify input data's basic integrity.
    function verifyInputDataIntegrity(
        Context ctx
        )
        private
        pure
    {
        require(ctx.miner != 0x0, "bad miner");
        require(
            ctx.ringSize == ctx.addressList.length,
            "wrong addressList size"
        );
        require(
            ctx.ringSize == ctx.uintArgsList.length,
            "wrong uintArgsList size"
        );
        require(
            ctx.ringSize == ctx.uint8ArgsList.length,
            "wrong uint8ArgsList size"
        );
        require(
            ctx.ringSize == ctx.buyNoMoreThanAmountBList.length,
            "wrong buyNoMoreThanAmountBList size"
        );

        // Validate ring-mining related arguments.
        for (uint i = 0; i < ctx.ringSize; i++) {
            require(ctx.uintArgsList[i][5] > 0, "rateAmountS is 0");
        }

        //Check ring size
        require(
            ctx.ringSize > 1 && ctx.ringSize <= MAX_RING_SIZE,
            "invalid ring size"
        );

        uint sigSize = ctx.ringSize << 1;
        require(sigSize == ctx.vList.length, "invalid vList size");
        require(sigSize == ctx.rList.length, "invalid rList size");
        require(sigSize == ctx.sList.length, "invalid sList size");
    }

    /// @dev Assemble input data into structs so we can pass them to other functions.
    /// This method also calculates ringHash, therefore it must be called before
    /// calling `verifyRingSignatures`.
    function assembleOrders(
        Context ctx
        )
        private
        view
    {
        for (uint i = 0; i < ctx.ringSize; i++) {
            uint[6] memory uintArgs = ctx.uintArgsList[i];
            bool marginSplitAsFee = (ctx.feeSelections & (uint16(1) << i)) > 0;
            ctx.orders[i] = OrderState(
                ctx.addressList[i][0],
                ctx.addressList[i][1],
                ctx.addressList[(i + 1) % ctx.ringSize][1],
                ctx.addressList[i][2],
                ctx.addressList[i][3],
                uintArgs[2],
                uintArgs[3],
                uintArgs[0],
                uintArgs[1],
                uintArgs[4],
                ctx.buyNoMoreThanAmountBList[i],
                marginSplitAsFee,
                bytes32(0),
                ctx.uint8ArgsList[i][0],
                uintArgs[5],
                uintArgs[1],
                0,   // fillAmountS
                0,   // lrcReward
                0,   // lrcFee
                0,   // splitS
                0    // splitB
            );

            validateOrder(ctx.orders[i]);

            bytes32 orderHash = calculateOrderHash(ctx.orders[i]);
            ctx.orders[i].orderHash = orderHash;

            verifySignature(
                ctx.orders[i].owner,
                orderHash,
                ctx.vList[i],
                ctx.rList[i],
                ctx.sList[i]
            );

            ctx.ringHash ^= orderHash;
        }

        ctx.ringHash = keccak256(
            ctx.ringHash,
            ctx.miner,
            ctx.feeSelections
        );
    }

   function validateOrdersCutoffs(
        Context ctx
        )
        private
        view
    {
        address[] memory owners = new address[](ctx.ringSize);
        bytes20[] memory tradingPairs = new bytes20[](ctx.ringSize);
        uint[] memory validSinceTimes = new uint[](ctx.ringSize);

        for (uint i = 0; i < ctx.ringSize; i++) {
            owners[i] = ctx.orders[i].owner;
            tradingPairs[i] = bytes20(ctx.orders[i].tokenS) ^ bytes20(ctx.orders[i].tokenB);
            validSinceTimes[i] = ctx.orders[i].validSince;
        }

        ctx.delegate.checkCutoffsBatch(owners, tradingPairs, validSinceTimes);
    }

    /// @dev Verify the ringHash has been signed with each order's auth private
    ///      keys as well as the miner's private key.
    function verifyRingSignatures(
        Context ctx
        )
        private
        pure
    {
        uint j;
        for (uint i = 0; i < ctx.ringSize; i++) {
            j = i + ctx.ringSize;

            verifySignature(
                ctx.orders[i].authAddr,
                ctx.ringHash,
                ctx.vList[j],
                ctx.rList[j],
                ctx.sList[j]
            );
        }
    }

    function verifyTokensRegistered(
        Context ctx
        )
        private
        view
    {
        // Extract the token addresses
        address[] memory tokens = new address[](ctx.ringSize);
        for (uint i = 0; i < ctx.ringSize; i++) {
            tokens[i] = ctx.orders[i].tokenS;
        }

        // Test all token addresses at once
        require(
            TokenRegistry(tokenRegistryAddress).areAllTokensRegistered(tokens),
            "token not registered"
        );
    }

    /// @dev Validate a ring.
    function verifyRingHasNoSubRing(
        Context ctx
        )
        private
        pure
    {
        // Check the ring has no sub-ring.
        for (uint i = 0; i < ctx.ringSize - 1; i++) {
            address tokenS = ctx.orders[i].tokenS;
            for (uint j = i + 1; j < ctx.ringSize; j++) {
                require(tokenS != ctx.orders[j].tokenS, "subring found");
            }
        }
    }

    /// @dev Exchange rates calculation are performed by ring-miners as solidity
    /// cannot get power-of-1/n operation, therefore we have to verify
    /// these rates are correct.
    function verifyMinerSuppliedFillRates(
        Context ctx
        )
        private
        view
    {
        uint[] memory rateRatios = new uint[](ctx.ringSize);
        uint _rateRatioScale = RATE_RATIO_SCALE;

        for (uint i = 0; i < ctx.ringSize; i++) {
            uint s1b0 = ctx.orders[i].rateS.mul(ctx.orders[i].amountB);
            uint s0b1 = ctx.orders[i].amountS.mul(ctx.orders[i].rateB);

            require(s1b0 <= s0b1, "invalid discount");

            rateRatios[i] = _rateRatioScale.mul(s1b0) / s0b1;
        }

        uint cvs = MathUint.cvsquare(rateRatios, _rateRatioScale);

        require(cvs <= rateRatioCVSThreshold, "uneven discount");
    }

    /// @dev Scale down all orders based on historical fill or cancellation
    ///      stats but key the order's original exchange rate.
    function scaleRingBasedOnHistoricalRecords(
        Context ctx
        )
        private
        view
    {

        uint ringSize = ctx.ringSize;
        OrderState[] memory orders = ctx.orders;

        for (uint i = 0; i < ringSize; i++) {
            OrderState memory state = orders[i];
            uint amount;

            if (state.buyNoMoreThanAmountB) {
                amount = state.amountB.tolerantSub(
                    ctx.delegate.cancelledOrFilled(state.orderHash)
                );

                state.amountS = amount.mul(state.amountS) / state.amountB;
                state.lrcFee = amount.mul(state.lrcFee) / state.amountB;

                state.amountB = amount;
            } else {
                amount = state.amountS.tolerantSub(
                    ctx.delegate.cancelledOrFilled(state.orderHash)
                );

                state.amountB = amount.mul(state.amountB) / state.amountS;
                state.lrcFee = amount.mul(state.lrcFee) / state.amountS;

                state.amountS = amount;
            }

            require(state.amountS > 0, "amountS scaled to 0");
            require(state.amountB > 0, "amountB scaled to 0");

            uint availableAmountS = getSpendable(ctx.delegate, state.tokenS, state.owner);
            require(availableAmountS > 0, "spendable is 0");

            state.fillAmountS = (
                state.amountS < availableAmountS ?
                state.amountS : availableAmountS
            );
        }
    }

    /// @dev Based on the already verified exchange rate provided by ring-miners,
    /// we can furthur scale down orders based on token balance and allowance,
    /// then find the smallest order of the ring, then calculate each order's
    /// `fillAmountS`.
    function calculateRingFillAmount(
        Context ctx
        )
        private
        pure
    {
        uint smallestIdx = 0;

        for (uint i = 0; i < ctx.ringSize; i++) {
            uint j = (i + 1) % ctx.ringSize;
            smallestIdx = calculateOrderFillAmount(
                ctx.orders[i],
                ctx.orders[j],
                i,
                j,
                smallestIdx
            );
        }

        for (uint i = 0; i < smallestIdx; i++) {
            calculateOrderFillAmount(
                ctx.orders[i],
                ctx.orders[(i + 1) % ctx.ringSize],
                0,               // Not needed
                0,               // Not needed
                0                // Not needed
            );
        }
    }

    /// @dev  Calculate each order's `lrcFee` and `lrcRewrard` and splict how much
    /// of `fillAmountS` shall be paid to matching order or miner as margin
    /// split.
    function calculateRingFees(
        Context ctx
        )
        private
        view
    {
        uint ringSize = ctx.ringSize;
        bool checkedMinerLrcSpendable = false;
        uint minerLrcSpendable = 0;
        uint8 _marginSplitPercentageBase = MARGIN_SPLIT_PERCENTAGE_BASE;
        uint nextFillAmountS;

        for (uint i = 0; i < ringSize; i++) {
            OrderState memory state = ctx.orders[i];
            uint lrcReceiable = 0;

            if (state.lrcFeeState == 0) {
                // When an order's LRC fee is 0 or smaller than the specified fee,
                // we help miner automatically select margin-split.
                state.marginSplitAsFee = true;
                state.marginSplitPercentage = _marginSplitPercentageBase;
            } else {
                uint lrcSpendable = getSpendable(
                    ctx.delegate,
                    lrcTokenAddress,
                    state.owner
                );

                // If the order is selling LRC, we need to calculate how much LRC
                // is left that can be used as fee.
                if (state.tokenS == lrcTokenAddress) {
                    lrcSpendable -= state.fillAmountS;
                }

                // If the order is buyign LRC, it will has more to pay as fee.
                if (state.tokenB == lrcTokenAddress) {
                    nextFillAmountS = ctx.orders[(i + 1) % ringSize].fillAmountS;
                    lrcReceiable = nextFillAmountS;
                }

                uint lrcTotal = lrcSpendable + lrcReceiable;

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
                        state.lrcFeeState -= lrcReceiable;
                    }
                }
            } else {

                // Only check the available miner balance when absolutely needed
                if (!checkedMinerLrcSpendable && minerLrcSpendable < state.lrcFeeState) {
                    checkedMinerLrcSpendable = true;
                    minerLrcSpendable = getSpendable(ctx.delegate, lrcTokenAddress, ctx.miner);
                }

                // Only calculate split when miner has enough LRC;
                // otherwise all splits are 0.
                if (minerLrcSpendable >= state.lrcFeeState) {
                    nextFillAmountS = ctx.orders[(i + 1) % ringSize].fillAmountS;
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
                        minerLrcSpendable -= state.lrcFeeState;
                        state.lrcReward = state.lrcFeeState;
                    }
                }

                state.lrcFeeState = 0;
            }
        }
    }

    function settleRing(
        Context ctx
        )
        private
    {
        bytes32[] memory batch = new bytes32[](ctx.ringSize * 7); // ringSize * (owner + tokenS + 4 amounts + wallet)
        uint[] memory orderInfoList = new uint[](ctx.ringSize * 6);

        uint p = 0;
        uint prevSplitB = ctx.orders[ctx.ringSize - 1].splitB;
        for (uint i = 0; i < ctx.ringSize; i++) {
            OrderState memory state = ctx.orders[i];
            uint nextFillAmountS = ctx.orders[(i + 1) % ctx.ringSize].fillAmountS;

            // Store owner and tokenS of every order
            batch[p] = bytes32(state.owner);
            batch[p + 1] = bytes32(state.tokenS);

            // Store all amounts
            batch[p + 2] = bytes32(state.fillAmountS - prevSplitB);
            batch[p + 3] = bytes32(prevSplitB + state.splitS);
            batch[p + 4] = bytes32(state.lrcReward);
            batch[p + 5] = bytes32(state.lrcFeeState);
            batch[p + 6] = bytes32(state.wallet);
            p += 7;

            // Update fill records
            if (state.buyNoMoreThanAmountB) {
                ctx.delegate.addCancelledOrFilled(state.orderHash, nextFillAmountS);
            } else {
                ctx.delegate.addCancelledOrFilled(state.orderHash, state.fillAmountS);
            }

            orderInfoList[i * 6 + 0] = uint(state.orderHash);
            orderInfoList[i * 6 + 1] = state.fillAmountS;
            orderInfoList[i * 6 + 2] = state.lrcReward;
            orderInfoList[i * 6 + 3] = state.lrcFeeState;
            orderInfoList[i * 6 + 4] = state.splitS;
            orderInfoList[i * 6 + 5] = state.splitB;

            prevSplitB = state.splitB;
        }

        // Do all transactions
        ctx.delegate.batchTransferToken(
            lrcTokenAddress,
            ctx.miner,
            walletSplitPercentage,
            batch
        );

        emit RingMined(
            ctx.ringIndex,
            ctx.ringHash,
            ctx.miner,
            orderInfoList
        );
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

    /// @dev validate order's parameters are OK.
    function validateOrder(
        OrderState order
        )
        private
        view
    {
        require(order.owner != 0x0, "invalid owner");
        require(order.tokenS != 0x0, "invalid tokenS");
        require(order.tokenB != 0x0, "nvalid tokenB");
        require(order.amountS != 0, "invalid amountS");
        require(order.amountB != 0, "invalid amountB");
        require(
            order.marginSplitPercentage <= MARGIN_SPLIT_PERCENTAGE_BASE,
            "invalid marginSplitPercentage"
        );

        require(order.validSince <= block.timestamp, "immature");
        require(order.validUntil > block.timestamp, "expired");
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
            ),
            "bad signature"
        );
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
