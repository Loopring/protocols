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

    // The following map is used to keep trace of order fill and cancellation
    // history.
    mapping (bytes32 => uint) public cancelledOrFilled;

    // This map is used to keep trace of order's cancellation history.
    mapping (bytes32 => uint) public cancelled;

    // A map from address to its cutoff timestamp.
    mapping (address => uint) public cutoffs;

    // A map from address to its trading-pair cutoff timestamp.
    mapping (address => mapping (bytes20 => uint)) public tradingPairCutoffs;

    struct Rate {
        uint amountS;
        uint amountB;
    }

    /// @param tokenS       Token to sell.
    /// @param tokenB       Token to buy.
    /// @param amountS      Maximum amount of tokenS to sell.
    /// @param amountB      Minimum amount of tokenB to buy if all amountS sold.
    /// @param wallet       Wallet address.
    /// @param authAddr     An address to verify miner has access to the order's
    ///                     auth private-key.
    /// @param validSince   Indicating when this order should be treated as
    ///                     valid for trading, in second.
    /// @param validUntil   Indicating when this order should be treated as
    ///                     expired, in second.
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
        address wallet;
        address authAddr;
        uint    validSince;
        uint    validUntil;
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
        bool    marginSplitAsFee;
        Rate    rate;
        uint    fillAmountS;
        uint    lrcReward;
        uint    lrcFee;
        uint    splitS;
        uint    splitB;
    }

    /// @dev A struct to capture parameters passed to submitRing method and
    ///      various of other variables used across the submitRing core logics.
    struct RingParams {
        address[4][]  addressList;
        uint[6][]     uintArgsList;
        uint8[1][]    uint8ArgsList;
        bool[]        buyNoMoreThanAmountBList;
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

        Order memory order = Order(
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
            marginSplitPercentage
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

        cancelled[orderHash] = cancelled[orderHash].add(cancelAmount);
        cancelledOrFilled[orderHash] = cancelledOrFilled[orderHash].add(cancelAmount);

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
        require(tradingPairCutoffs[msg.sender][tokenPair] < t);
        // "attempted to set cutoff to a smaller value"

        tradingPairCutoffs[msg.sender][tokenPair] = t;
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

        require(cutoffs[msg.sender] < t); // "attempted to set cutoff to a smaller value"

        cutoffs[msg.sender] = t;
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
            addressList,
            uintArgsList,
            uint8ArgsList,
            buyNoMoreThanAmountBList,
            vList,
            rList,
            sList,
            miner,
            feeSelections,
            addressList.length,
            0x0 // ringHash
        );

        verifyInputDataIntegrity(params);

        // Assemble input data into structs so we can pass them to other functions.
        // This method also calculates ringHash, therefore it must be called before
        // calling `verifyRingSignatures`.
        OrderState[] memory orders = assembleOrders(params);

        verifyRingSignatures(params);

        verifyTokensRegistered(params);

        handleRing(_ringIndex, params, orders);

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
            address tokenS = orders[i].order.tokenS;
            for (uint j = i + 1; j < ringSize; j++) {
                require(tokenS != orders[j].order.tokenS); // "found sub-ring");
            }
        }
    }

    /// @dev Verify the ringHash has been signed with each order's auth private
    ///      keys as well as the miner's private key.
    function verifyRingSignatures(
        RingParams params
        )
        private
        pure
    {
        uint j;
        for (uint i = 0; i < params.ringSize; i++) {
            j = i + params.ringSize;

            verifySignature(
                params.addressList[i][3],  // authAddr
                params.ringHash,
                params.vList[j],
                params.rList[j],
                params.sList[j]
            );
        }
    }

    function verifyTokensRegistered(
        RingParams params
        )
        private
        view
    {
        // Extract the token addresses
        address[] memory tokens = new address[](params.ringSize);
        for (uint i = 0; i < params.ringSize; i++) {
            tokens[i] = params.addressList[i][1];
        }

        // Test all token addresses at once
        require(
            TokenRegistry(tokenRegistryAddress).areAllTokensRegistered(tokens)
        ); // "token not registered");
    }

    function handleRing(
        uint64       _ringIndex,
        RingParams   params,
        OrderState[] orders
        )
        private
    {
        address _lrcTokenAddress = lrcTokenAddress;
        TokenTransferDelegate delegate = TokenTransferDelegate(delegateAddress);

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
        bytes32[] memory orderHashList;
        uint[6][] memory amountsList;
        (orderHashList, amountsList) = settleRing(
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
            orderHashList,
            amountsList
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
        returns (
        bytes32[] memory orderHashList,
        uint[6][] memory amountsList)
    {
        bytes32[] memory batch = new bytes32[](ringSize * 7); // ringSize * (owner + tokenS + 4 amounts + wallet)
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
            batch[p + 1] = bytes32(order.tokenS);

            // Store all amounts
            batch[p + 2] = bytes32(state.fillAmountS - prevSplitB);
            batch[p + 3] = bytes32(prevSplitB + state.splitS);
            batch[p + 4] = bytes32(state.lrcReward);
            batch[p + 5] = bytes32(state.lrcFee);
            batch[p + 6] = bytes32(order.wallet);
            p += 7;

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
            uint s1b0 = orders[i].rate.amountS.mul(orders[i].order.amountB);
            uint s0b1 = orders[i].order.amountS.mul(orders[i].rate.amountB);

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

            if (state.lrcFee == 0) {
                // When an order's LRC fee is 0 or smaller than the specified fee,
                // we help miner automatically select margin-split.
                state.marginSplitAsFee = true;
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
                    state.marginSplitAsFee = true;
                }
            }

            if (!state.marginSplitAsFee) {
                if (lrcReceiable > 0) {
                    if (lrcReceiable >= state.lrcFee) {
                        state.splitB = state.lrcFee;
                        state.lrcFee = 0;
                    } else {
                        state.splitB = lrcReceiable;
                        state.lrcFee -= lrcReceiable;
                    }
                }
            } else {

                // Only check the available miner balance when absolutely needed
                if (!checkedMinerLrcSpendable && minerLrcSpendable < state.lrcFee) {
                    checkedMinerLrcSpendable = true;
                    minerLrcSpendable = getSpendable(delegate, _lrcTokenAddress, miner);
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
        RingParams params
        )
        private
        pure
    {
        require(params.miner != 0x0);
        require(params.ringSize == params.addressList.length);
        require(params.ringSize == params.uintArgsList.length);
        require(params.ringSize == params.uint8ArgsList.length);
        require(params.ringSize == params.buyNoMoreThanAmountBList.length);

        // Validate ring-mining related arguments.
        for (uint i = 0; i < params.ringSize; i++) {
            require(params.uintArgsList[i][5] > 0); // "order rateAmountS is zero");
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
        RingParams params
        )
        private
        view
        returns (OrderState[] memory orders)
    {
        orders = new OrderState[](params.ringSize);

        for (uint i = 0; i < params.ringSize; i++) {

            Order memory order = Order(
                params.addressList[i][0],
                params.addressList[i][1],
                params.addressList[(i + 1) % params.ringSize][1],
                params.addressList[i][2],
                params.addressList[i][3],
                params.uintArgsList[i][2],
                params.uintArgsList[i][3],
                params.uintArgsList[i][0],
                params.uintArgsList[i][1],
                params.uintArgsList[i][4],
                params.buyNoMoreThanAmountBList[i],
                params.uint8ArgsList[i][0]
            );

            validateOrder(order);

            bytes32 orderHash = calculateOrderHash(order);

            verifySignature(
                order.owner,
                orderHash,
                params.vList[i],
                params.rList[i],
                params.sList[i]
            );

            bool marginSplitAsFee = (params.feeSelections & (uint16(1) << i)) > 0;
            orders[i] = OrderState(
                order,
                orderHash,
                marginSplitAsFee,
                Rate(params.uintArgsList[i][5], order.amountB),
                0,   // fillAmountS
                0,   // lrcReward
                0,   // lrcFee
                0,   // splitS
                0    // splitB
            );

            params.ringHash ^= orderHash;
        }

        params.ringHash = keccak256(
            params.ringHash,
            params.feeSelections
        );
    }

    /// @dev validate order's parameters are OK.
    function validateOrder(
        Order order
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

        bytes20 tradingPair = bytes20(order.tokenS) ^ bytes20(order.tokenB);
        require(order.validSince > tradingPairCutoffs[order.owner][tradingPair]);
        // order trading pair is cut off
        require(order.validSince > cutoffs[order.owner]); // order is cut off
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
            address(this),
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
        return tradingPairCutoffs[orderOwner][tokenPair];
    }
}
