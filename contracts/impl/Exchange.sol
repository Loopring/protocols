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

import "../lib/AddressUtil.sol";
import "../lib/BytesUtil.sol";
import "../lib/ERC20.sol";
import "../lib/MathUint.sol";
import "../lib/MultihashUtil.sol";
import "../lib/NoDefaultFunc.sol";
import "../iface/IBrokerRegistry.sol";
import "../iface/IBrokerInterceptor.sol";
import "../iface/IExchange.sol";
import "../iface/ITokenRegistry.sol";
import "../iface/ITradeDelegate.sol";


/// @title An Implementation of IExchange.
/// @author Daniel Wang - <daniel@loopring.org>,
/// @author Kongliang Zhong - <kongliang@loopring.org>
///
/// Recognized contributing developers from the community:
///     https://github.com/Brechtpd
///     https://github.com/rainydio
///     https://github.com/BenjaminPrice
///     https://github.com/jonasshen
///     https://github.com/Hephyrius
contract Exchange is IExchange, NoDefaultFunc {
    using AddressUtil   for address;
    using MathUint      for uint;

    address public  lrcTokenAddress             = 0x0;
    address public  tokenRegistryAddress        = 0x0;
    address public  delegateAddress             = 0x0;
    address public  brokerRegistryAddress       = 0x0;

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
    uint    public rateRatioCVSThreshold        = 0;

    uint    public constant MAX_RING_SIZE       = 8;

    uint    public constant RATE_RATIO_SCALE    = 10000;

    struct Order {
        address owner;
        address broker;
        address tokenS;
        address tokenB;
        address wallet;
        address authAddr;
        address interceptor;
        uint    amountS;
        uint    amountB;
        uint    validSince;
        uint    validUntil;
        uint    lrcFee;
        uint8   option;
        bool    optCapByAmountB;
        bool    optAllOrNone;
        bool    marginSplitAsFee;
        bytes32 orderHash;
        address brokerInterceptor;
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
        address[6][]  addressesList;
        uint[6][]     valuesList;
        uint8[]       optionList;
        bytes[]       sigList;
        address       feeRecipient;
        address       interceptor;
        uint8         feeSelections;
        uint64        ringIndex;
        uint          ringSize;         // computed
        ITradeDelegate         delegate;
        IBrokerRegistry        brokerRegistry;
        Order[]  orders;
        bytes32       ringHash;         // computed
    }

    constructor(
        address _lrcTokenAddress,
        address _tokenRegistryAddress,
        address _delegateAddress,
        address _brokerRegistryAddress,
        uint    _rateRatioCVSThreshold
        )
        public
    {
        require(_lrcTokenAddress.isContract());
        require(_tokenRegistryAddress.isContract());
        require(_delegateAddress.isContract());
        require(_brokerRegistryAddress.isContract());

        require(_rateRatioCVSThreshold > 0);

        lrcTokenAddress = _lrcTokenAddress;
        tokenRegistryAddress = _tokenRegistryAddress;
        delegateAddress = _delegateAddress;
        brokerRegistryAddress = _brokerRegistryAddress;
        rateRatioCVSThreshold = _rateRatioCVSThreshold;
    }

    function cancelOrders(
        address owner,
        bytes   orderHashes
        )
        external
    {
        uint size = orderHashes.length;
        require(size > 0 && size % 32 == 0);

        verifyAuthenticationGetInterceptor(
            owner,
            tx.origin
        );

        size /= 32;
        bytes32[] memory hashes = new bytes32[](size);

        ITradeDelegate delegate = ITradeDelegate(delegateAddress);

        for (uint i = 0; i < size; i++) {
            hashes[i] = BytesUtil.bytesToBytes32(orderHashes, i * 32);
            delegate.setCancelled(owner, hashes[i]);
        }

        emit OrdersCancelled(
            owner,
            tx.origin,
            hashes
        );
    }

    function cancelAllOrdersForTradingPair(
        address owner,
        address token1,
        address token2,
        uint    cutoff
        )
        external
    {
        verifyAuthenticationGetInterceptor(owner, tx.origin);

        uint t = (cutoff == 0 || cutoff >= block.timestamp) ? block.timestamp : cutoff;

        bytes20 tokenPair = bytes20(token1) ^ bytes20(token2);

        ITradeDelegate(delegateAddress).setTradingPairCutoffs(
            owner,
            tokenPair,
            t
        );

        emit AllOrdersCancelledForTradingPair(
            owner,
            tx.origin,
            token1,
            token2,
            t
        );
    }

    function cancelAllOrders(
        address owner,
        uint   cutoff
        )
        external
    {
        verifyAuthenticationGetInterceptor(
            owner,
            tx.origin
        );

        uint t = (cutoff == 0 || cutoff >= block.timestamp) ? block.timestamp : cutoff;

        ITradeDelegate(delegateAddress).setCutoffs(owner, t);

        emit AllOrdersCancelled(
            owner,
            tx.origin,
            t
        );
    }

    function submitRing(
        address[6][]  addressesList,
        uint[6][]     valuesList,
        uint8[]       optionList,
        bytes[]       sigList,
        address       feeRecipient,
        address       interceptor,
        uint8         feeSelections
        )
        public
    {
        Context memory ctx = Context(
            addressesList,
            valuesList,
            optionList,
            sigList,
            feeRecipient,
            interceptor,
            feeSelections,
            ringIndex,
            addressesList.length,
            ITradeDelegate(delegateAddress),
            IBrokerRegistry(brokerRegistryAddress),
            new Order[](addressesList.length),
            0x0 // ringHash
        );

        // Check if the highest bit of ringIndex is '1'.
        require((ringIndex >> 63) == 0, "reentry");

        // Set the highest bit of ringIndex to '1'.
        ringIndex |= (uint64(1) << 63);

        verifyInputDataIntegrity(ctx);

        assembleOrders(ctx);

        checkOrdersNotCancelled(ctx);

        verifyRingSignatures(ctx);

        verifyTokensRegistered(ctx);

        verifyRingHasNoSubRing(ctx);

        verifyMinerSuppliedFillRates(ctx);

        scaleOrders(ctx);

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
        view
    {
        if (ctx.feeRecipient == 0x0) {
            ctx.feeRecipient = tx.origin;
        }

        //Check ring size
        require(
            ctx.ringSize > 1 && ctx.ringSize <= MAX_RING_SIZE,
            "invalid ring size"
        );

        require(
            ctx.ringSize == ctx.addressesList.length,
            "wrong addressesList size"
        );

        require(
            ctx.ringSize == ctx.valuesList.length,
            "wrong valuesList size"
        );

        require(
            ctx.ringSize == ctx.optionList.length,
            "wrong optionList size"
        );

        require(
            (ctx.ringSize << 1) == ctx.sigList.length,
            "invalid signature size"
        );

        // Validate ring-mining related arguments.

        for (uint i = 0; i < ctx.ringSize; i++) {
            require(ctx.valuesList[i][5] > 0, "rateAmountS is 0");
       }
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

            uint[6] memory uintArgs = ctx.valuesList[i];
            bool marginSplitAsFee = (ctx.feeSelections & (uint8(1) << i)) > 0;

            Order memory order = Order(
                ctx.addressesList[i][0],
                ctx.addressesList[i][1],
                ctx.addressesList[i][2],
                ctx.addressesList[(i + 2) % ctx.ringSize][1],
                ctx.addressesList[i][3],
                ctx.addressesList[i][4],
                ctx.addressesList[i][5],
                uintArgs[0],
                uintArgs[1],
                uintArgs[2],
                uintArgs[3],
                uintArgs[4],
                ctx.optionList[i],
                ctx.optionList[i] & OPTION_MASK_CAP_BY_AMOUNTB > 0 ? true : false,
                ctx.optionList[i] & OPTION_MASK_ALL_OR_NONE > 0 ? true : false,
                marginSplitAsFee,
                0x0,
                0x0,  // brokderTracker
                uintArgs[5],
                uintArgs[1],
                0,   // fillAmountS
                0,   // lrcReward
                0,   // lrcFee
                0,   // splitS
                0.   // splitB
            );

            validateOrder(order);

            order.orderHash = calculateOrderHash(order);

            MultihashUtil.verifySignature(
                order.broker,
                order.orderHash,
                ctx.sigList[i]
           );

            order.brokerInterceptor = verifyAuthenticationGetInterceptor(
                order.owner,
                order.broker
            );

            ctx.orders[i] = order;
            ctx.ringHash ^= order.orderHash;
        }

        ctx.ringHash = keccak256(
            ctx.ringHash,
            ctx.feeRecipient,
            ctx.feeSelections
        );
    }

   function checkOrdersNotCancelled(
        Context ctx
        )
        private
        view
    {
        address[] memory owners = new address[](ctx.ringSize);
        bytes20[] memory tradingPairs = new bytes20[](ctx.ringSize);
        uint[] memory validSinceTimes = new uint[](ctx.ringSize);

        for (uint i = 0; i < ctx.ringSize; i++) {
            Order memory order = ctx.orders[i];

            require(
                !ctx.delegate.cancelled(order.owner, order.orderHash),
                "ordre cancelled already"
            );

            owners[i] = order.owner;
            tradingPairs[i] = bytes20(order.tokenS) ^ bytes20(order.tokenB);
            validSinceTimes[i] = order.validSince;
        }

        ctx.delegate.checkCutoffsBatch(
            owners,
            tradingPairs,
            validSinceTimes
        );
    }

    /// @dev Verify the ringHash has been signed with each order's auth private
    ///      keys.
    function verifyRingSignatures(
        Context ctx
        )
        private
        pure
    {
        uint j;
        for (uint i = 0; i < ctx.ringSize; i++) {
            j = i + ctx.ringSize;

            MultihashUtil.verifySignature(
                ctx.orders[i].authAddr,
                ctx.ringHash,
                ctx.sigList[i]
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
            ITokenRegistry(tokenRegistryAddress).areAllTokensRegistered(tokens),
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
    function scaleOrders(
        Context ctx
        )
        private
        view
    {
        uint ringSize = ctx.ringSize;
        Order[] memory orders = ctx.orders;

        for (uint i = 0; i < ringSize; i++) {
            Order memory order = orders[i];

            if (order.optAllOrNone) {
                require(
                    ctx.delegate.filled(order.orderHash) == 0,
                    "AON filled or cancelled already"
                );
            } else {
                uint amount;

                if (order.optCapByAmountB) {
                    amount = order.amountB.tolerantSub(
                        ctx.delegate.filled(order.orderHash)
                    );

                    order.amountS = amount.mul(order.amountS) / order.amountB;
                    order.lrcFee = amount.mul(order.lrcFee) / order.amountB;

                    order.amountB = amount;
                } else {
                    amount = order.amountS.tolerantSub(
                        ctx.delegate.filled(order.orderHash)
                    );

                    order.amountB = amount.mul(order.amountB) / order.amountS;
                    order.lrcFee = amount.mul(order.lrcFee) / order.amountS;

                    order.amountS = amount;
                }
            }

            require(order.amountS > 0, "amountS scaled to 0");
            require(order.amountB > 0, "amountB scaled to 0");

            uint availableAmountS = getSpendable(
                ctx.delegate,
                order.tokenS,
                order.owner,
                order.broker,
                order.brokerInterceptor
            );

            // This check is more strict than it needs to be, in case the
            // `optCapByAmountB`is true.
            if (order.optAllOrNone) {
                require(
                    availableAmountS >= order.amountS,
                    "AON spendable"
                );
            } else {
                require(availableAmountS > 0, "spendable is 0");
                order.fillAmountS = (
                    order.amountS < availableAmountS ?
                    order.amountS : availableAmountS
                );
                require(order.fillAmountS > 0, "fillAmountS is 0");
            }
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
    /// of `fillAmountS` shall be paid to matching order or fee recipient as margin
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
        uint nextFillAmountS;

        for (uint i = 0; i < ringSize; i++) {
            Order memory order = ctx.orders[i];
            uint lrcReceiable = 0;

            if (order.lrcFeeState == 0) {
                // When an order's LRC fee is 0 or smaller than the specified fee,
                // we help miner automatically select margin-split.
                order.marginSplitAsFee = true;
            } else {
                uint lrcSpendable = getSpendable(
                    ctx.delegate,
                    lrcTokenAddress,
                    order.owner,
                    order.broker,
                    order.brokerInterceptor
                );

                // If the order is selling LRC, we need to calculate how much LRC
                // is left that can be used as fee.
                if (order.tokenS == lrcTokenAddress) {
                    lrcSpendable = lrcSpendable.sub(order.fillAmountS);
                }

                // If the order is buyign LRC, it will has more to pay as fee.
                if (order.tokenB == lrcTokenAddress) {
                    nextFillAmountS = ctx.orders[(i + 1) % ringSize].fillAmountS;
                    lrcReceiable = nextFillAmountS;
                }

                uint lrcTotal = lrcSpendable.add(lrcReceiable);

                // If order doesn't have enough LRC, set margin split to 100%.
                if (lrcTotal < order.lrcFeeState) {
                    order.lrcFeeState = lrcTotal;
                }

                if (order.lrcFeeState == 0) {
                    order.marginSplitAsFee = true;
                }
            }

            if (!order.marginSplitAsFee) {
                if (lrcReceiable > 0) {
                    if (lrcReceiable >= order.lrcFeeState) {
                        order.splitB = order.lrcFeeState;
                        order.lrcFeeState = 0;
                    } else {
                        order.splitB = lrcReceiable;
                        order.lrcFeeState = order.lrcFeeState.sub(lrcReceiable);
                    }
                }
            } else {

                // Only check the available miner balance when absolutely needed
                if (!checkedMinerLrcSpendable && minerLrcSpendable < order.lrcFeeState) {
                    checkedMinerLrcSpendable = true;
                    minerLrcSpendable = getSpendable(
                        ctx.delegate,
                        lrcTokenAddress,
                        tx.origin,
                        0x0,
                        0x0
                    );
                }

                // Only calculate split when miner has enough LRC;
                // otherwise all splits are 0.
                if (minerLrcSpendable >= order.lrcFeeState) {
                    nextFillAmountS = ctx.orders[(i + 1) % ringSize].fillAmountS;
                    uint split;
                    if (order.optCapByAmountB) {
                        split = (nextFillAmountS.mul(
                            order.amountS
                        ) / order.amountB).sub(
                            order.fillAmountS
                        ) / 2;
                    } else {
                        split = nextFillAmountS.sub(
                            order.fillAmountS.mul(
                                order.amountB
                            ) / order.amountS
                        ) / 2;
                    }

                    if (order.optCapByAmountB) {
                        order.splitS = split;
                    } else {
                        order.splitB = split;
                    }

                    // This implicits order with smaller index in the ring will
                    // be paid LRC reward first, so the orders in the ring does
                    // mater.
                    if (split > 0) {
                        minerLrcSpendable = minerLrcSpendable.sub(order.lrcFeeState);
                        order.lrcReward = order.lrcFeeState;
                    }
                }

                order.lrcFeeState = 0;
            }
        }
    }

    function settleRing(
        Context ctx
        )
        private
    {
        bytes32[] memory batch = new bytes32[](ctx.ringSize * 7);
        bytes32[] memory historyBatch = new bytes32[](ctx.ringSize * 2);
        Fill[] memory fills = new Fill[](ctx.ringSize);

        uint p = 0;
        uint q = 0;
        uint prevSplitB = ctx.orders[ctx.ringSize - 1].splitB;
        for (uint i = 0; i < ctx.ringSize; i++) {
            Order memory order = ctx.orders[i];
            uint nextFillAmountS = ctx.orders[(i + 1) % ctx.ringSize].fillAmountS;

            // Store owner and tokenS of every order
            batch[p++] = bytes32(order.owner);
            batch[p++] = bytes32(order.broker);
            batch[p++] = bytes32(order.brokerInterceptor);
            batch[p++] = bytes32(order.tokenS);

            // Store all amounts
            batch[p++] = bytes32(order.fillAmountS - prevSplitB);
            batch[p++] = bytes32(prevSplitB + order.splitS);
            batch[p++] = bytes32(order.lrcReward);
            batch[p++] = bytes32(order.lrcFeeState);
            batch[p++] = bytes32(order.wallet);

            historyBatch[q++] = order.orderHash;
            historyBatch[q++] = bytes32(
                order.optCapByAmountB ? nextFillAmountS : order.fillAmountS
            );

            fills[i]  = Fill(
                order.orderHash,
                order.owner,
                order.tokenS,
                order.fillAmountS,
                order.splitS > 0 ? int(order.splitS) : -int(order.splitB),
                int(order.lrcFeeState) - int(order.lrcReward)
            );

            prevSplitB = order.splitB;
        }

        ctx.delegate.batchUpdateHistoryAndTransferTokens(
            lrcTokenAddress,
            tx.origin,
            ctx.feeRecipient,
            historyBatch,
            batch
        );

        emit RingMined(
            ctx.ringIndex,
            tx.origin,
            ctx.feeRecipient,
            fills
        );
    }

    /// @return The smallest order's index.
    function calculateOrderFillAmount(
        Order order,
        Order next,
        uint  i,
        uint  j,
        uint  smallestIdx
        )
        private
        pure
        returns (uint newSmallestIdx)
    {
        // Default to the same smallest index
        newSmallestIdx = smallestIdx;

        uint fillAmountB = order.fillAmountS.mul(
            order.rateB
        ) / order.rateS;

        if (order.optCapByAmountB) {
            if (fillAmountB > order.amountB) {
                fillAmountB = order.amountB;

                order.fillAmountS = fillAmountB.mul(
                    order.rateS
                ) / order.rateB;
                require(order.fillAmountS > 0, "fillAmountS is 0");

                newSmallestIdx = i;
            }
            order.lrcFeeState = order.lrcFee.mul(
                fillAmountB
            ) / order.amountB;
        } else {
            order.lrcFeeState = order.lrcFee.mul(
                order.fillAmountS
            ) / order.amountS;
        }

        // Check All-or-None orders
        if (order.optAllOrNone){
            if (order.optCapByAmountB) {
                require(
                    fillAmountB >= order.amountB,
                    "AON failed on amountB"
                );
            } else {
                require(
                    order.fillAmountS >= order.amountS,
                     "AON failed on amountS"
                );
            }
        }

        if (fillAmountB <= next.fillAmountS) {
            next.fillAmountS = fillAmountB;
        } else {
            newSmallestIdx = j;
        }
    }

    /// @return Amount of ERC20 token that can be spent by this contract.
    function getSpendable(
        ITradeDelegate delegate,
        address tokenAddress,
        address tokenOwner,
        address broker,
        address brokerInterceptor
        )
        private
        view
        returns (uint spendable)
    {
        ERC20 token = ERC20(tokenAddress);
        spendable = token.allowance(
            tokenOwner,
            address(delegate)
        );
        if (spendable == 0) {
            return;
        }
        uint amount = token.balanceOf(tokenOwner);
        if (amount < spendable) {
            spendable = amount;
            if (spendable == 0) {
                return;
            }
        }

        if (brokerInterceptor != 0x0) {
            amount = IBrokerInterceptor(brokerInterceptor).getAllowance(
                tokenOwner,
                broker,
                tokenAddress
            );
            if (amount < spendable) {
                spendable = amount;
            }
        }
    }

    /// @dev validate order's parameters are OK.
    function validateOrder(
        Order order
        )
        private
        view
    {
        require(order.owner != 0x0, "invalid owner");
        require(order.tokenS != 0x0, "invalid tokenS");
        require(order.tokenB != 0x0, "nvalid tokenB");
        require(order.amountS != 0, "invalid amountS");
        require(order.amountB != 0, "invalid amountB");
        require(order.validSince <= block.timestamp, "immature");
        require(order.validUntil > block.timestamp, "expired");
    }

    /// @dev Get the Keccak-256 hash of order with specified parameters.
    function calculateOrderHash(
        Order order
        )
        private
        view
        returns (bytes32)
    {
        return keccak256(
            delegateAddress,
            order.owner,
            order.broker,
            order.tokenS,
            order.tokenB,
            order.wallet,
            order.authAddr,
            order.amountS,
            order.amountB,
            order.validSince,
            order.validUntil,
            order.lrcFee,
            order.option
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
        ITradeDelegate delegate = ITradeDelegate(delegateAddress);
        return delegate.tradingPairCutoffs(orderOwner, tokenPair);
    }

    function verifyAuthenticationGetInterceptor(
        address owner,
        address signer
        )
        private
        view
        returns (address brokerInterceptor)
    {
        if (signer == owner) {
            brokerInterceptor = 0x0;
        } else {
            IBrokerRegistry brokerRegistry = IBrokerRegistry(brokerRegistryAddress);
            bool authenticated;
            (authenticated, brokerInterceptor) = brokerRegistry.getBroker(owner, signer);
            require(authenticated, "broker unauthenticated");
        }
    }
}
