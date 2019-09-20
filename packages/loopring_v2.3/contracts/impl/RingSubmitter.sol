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
pragma solidity 0.5.7;
pragma experimental ABIEncoderV2;

import "../helper/MiningHelper.sol";
import "../helper/OrderHelper.sol";
import "../helper/RingHelper.sol";

import "../iface/IBrokerRegistry.sol";
import "../iface/IBurnRateTable.sol";
import "../iface/IFeeHolder.sol";
import "../iface/IOrderRegistry.sol";
import "../iface/IOrderBook.sol";
import "../iface/IRingSubmitter.sol";
import "../iface/ITradeDelegate.sol";
import "../iface/ITradeHistory.sol";
import "../iface/IBrokerDelegate.sol";

import "../lib/BytesUtil.sol";
import "../lib/MathUint.sol";
import "../lib/NoDefaultFunc.sol";
import "../lib/ERC20SafeTransfer.sol";

import "./Data.sol";
import "./ExchangeDeserializer.sol";

/// @title An Implementation of IRingSubmitter.
/// @author Daniel Wang - <daniel@loopring.org>,
/// @author Kongliang Zhong - <kongliang@loopring.org>
/// @author Brechtpd - <brecht@loopring.org>
/// Recognized contributing developers from the community:
///     https://github.com/rainydio
///     https://github.com/BenjaminPrice
///     https://github.com/jonasshen
///     https://github.com/Hephyrius
contract RingSubmitter is IRingSubmitter, NoDefaultFunc {
    using MathUint          for uint;
    using BytesUtil         for bytes;
    using OrderHelper       for Data.Order;
    using RingHelper        for Data.Ring;
    using MiningHelper      for Data.Mining;
    using ERC20SafeTransfer for address;

    address public  lrcTokenAddress             = address(0x0);
    address public  wethTokenAddress            = address(0x0);
    address public  delegateAddress             = address(0x0);
    address public  tradeHistoryAddress         = address(0x0);
    address public  orderBrokerRegistryAddress  = address(0x0);
    address public  orderRegistryAddress        = address(0x0);
    address public  feeHolderAddress            = address(0x0);
    address public  orderBookAddress            = address(0x0);
    address public  burnRateTableAddress        = address(0x0);

    uint64  public  ringIndex                   = 0;

    uint    public constant MAX_RING_SIZE       = 8;

    struct SubmitRingsParam {
        uint16[]    encodeSpecs;
        uint16      miningSpec;
        uint16[]    orderSpecs;
        uint8[][]   ringSpecs;
        address[]   addressList;
        uint[]      uintList;
        bytes[]     bytesList;
    }

    constructor(
        address _lrcTokenAddress,
        address _wethTokenAddress,
        address _delegateAddress,
        address _tradeHistoryAddress,
        address _orderBrokerRegistryAddress,
        address _orderRegistryAddress,
        address _feeHolderAddress,
        address _orderBookAddress,
        address _burnRateTableAddress
        )
        public
    {
        require(_lrcTokenAddress != address(0x0), ZERO_ADDRESS);
        require(_wethTokenAddress != address(0x0), ZERO_ADDRESS);
        require(_delegateAddress != address(0x0), ZERO_ADDRESS);
        require(_tradeHistoryAddress != address(0x0), ZERO_ADDRESS);
        require(_orderBrokerRegistryAddress != address(0x0), ZERO_ADDRESS);
        require(_orderRegistryAddress != address(0x0), ZERO_ADDRESS);
        require(_feeHolderAddress != address(0x0), ZERO_ADDRESS);
        require(_orderBookAddress != address(0x0), ZERO_ADDRESS);
        require(_burnRateTableAddress != address(0x0), ZERO_ADDRESS);

        lrcTokenAddress = _lrcTokenAddress;
        wethTokenAddress = _wethTokenAddress;
        delegateAddress = _delegateAddress;
        tradeHistoryAddress = _tradeHistoryAddress;
        orderBrokerRegistryAddress = _orderBrokerRegistryAddress;
        orderRegistryAddress = _orderRegistryAddress;
        feeHolderAddress = _feeHolderAddress;
        orderBookAddress = _orderBookAddress;
        burnRateTableAddress = _burnRateTableAddress;
    }

    function submitRings(
        bytes calldata data
        )
        external
    {
        uint i;
        bytes32[] memory tokenBurnRates;

        (
            Data.Mining  memory mining,
            Data.Order[] memory orders,
            Data.Ring[]  memory rings
        ) = ExchangeDeserializer.deserialize(lrcTokenAddress, data);

        Data.Context memory ctx = Data.Context(
            lrcTokenAddress,
            ITradeDelegate(delegateAddress),
            ITradeHistory(tradeHistoryAddress),
            IBrokerRegistry(orderBrokerRegistryAddress),
            IOrderRegistry(orderRegistryAddress),
            IFeeHolder(feeHolderAddress),
            IOrderBook(orderBookAddress),
            IBurnRateTable(burnRateTableAddress),
            ringIndex,
            FEE_PERCENTAGE_BASE,
            tokenBurnRates,
            0,
            0,
            0,
            0,
            new Data.BrokerOrder[](orders.length),
            new Data.BrokerAction[](orders.length),
            new Data.BrokerTransfer[](orders.length * 3),
            0,
            0,
            0
        );

        // Set the highest bit of ringIndex to '1' (IN STORAGE!)
        ringIndex = ctx.ringIndex | (1 << 63);

        // Check if the highest bit of ringIndex is '1'
        require((ctx.ringIndex >> 63) == 0, REENTRY);

        // Allocate memory that is used to batch things for all rings
        setupLists(ctx, orders, rings);

        for (i = 0; i < orders.length; i++) {
            orders[i].updateHash();
        }

        batchGetFilledAndCheckCancelled(ctx, orders);

        for (i = 0; i < orders.length; i++) {
            orders[i].check(ctx);
            // An order can only be sent once
            for (uint j = i + 1; j < orders.length; j++) {
                require(orders[i].hash != orders[j].hash, INVALID_VALUE);
            }
        }

        for (i = 0; i < rings.length; i++) {
            rings[i].updateHash();
        }

        mining.updateHash(rings);
        mining.updateMinerAndInterceptor();
        require(mining.checkMinerSignature(), INVALID_SIG);

        for (i = 0; i < orders.length; i++) {
            // We don't need to verify the dual author signature again if it uses the same
            // dual author address as the previous order (the miner can optimize the order of the orders
            // so this happens as much as possible). We don't need to check if the signature is the same
            // because the same mining hash is signed for all orders.
            if(i > 0 && orders[i].dualAuthAddr == orders[i - 1].dualAuthAddr) {
                continue;
            }
            orders[i].checkDualAuthSignature(mining.hash);
        }

        for (i = 0; i < rings.length; i++) {
            Data.Ring memory ring = rings[i];
            ring.checkOrdersValid();
            // ring.checkForSubRings(); we submit rings of size 2 - there's no need to check for sub-rings
            ring.calculateFillAmountAndFee(ctx);
            if (ring.valid) {
                ring.adjustOrderStates();
            }
        }

        // Check if the allOrNone orders are completely filled over all rings
        // This can invalidate rings
        checkRings(orders, rings);

        for (i = 0; i < rings.length; i++) {
            Data.Ring memory ring = rings[i];
            if (ring.valid) {
                // Only settle rings we have checked to be valid
                ring.doPayments(ctx, mining);
                emitRingMinedEvent(
                    ring,
                    ctx.ringIndex++,
                    mining.feeRecipient
                );
            } else {
                emit InvalidRing(ring.hash);
            }
        }

        // Do all token transfers for all rings
        batchTransferTokens(ctx);
        // Do all broker token transfers for all rings
        batchBrokerTransferTokens(ctx, orders);
        // Do all fee payments for all rings
        batchPayFees(ctx);
        // Update all order stats
        updateOrdersStats(ctx, orders);

        // Update ringIndex while setting the highest bit of ringIndex back to '0'
        ringIndex = ctx.ringIndex;
    }

    function checkRings(
        Data.Order[] memory orders,
        Data.Ring[] memory rings
        )
        internal
        pure
    {
        // Check if allOrNone orders are completely filled
        // When a ring is turned invalid because of an allOrNone order we have to
        // recheck the other rings again because they may contain other allOrNone orders
        // that may not be completely filled anymore.
        bool reevaluateRings = true;
        while (reevaluateRings) {
            reevaluateRings = false;
            for (uint i = 0; i < orders.length; i++) {
                if (orders[i].valid) {
                    orders[i].validateAllOrNone();
                    // Check if the order valid status has changed
                    reevaluateRings = reevaluateRings || !orders[i].valid;
                }
            }
            if (reevaluateRings) {
                for (uint i = 0; i < rings.length; i++) {
                    Data.Ring memory ring = rings[i];
                    if (ring.valid) {
                        ring.checkOrdersValid();
                        if (!ring.valid) {
                            // If the ring was valid before the completely filled check we have to revert the filled amountS
                            // of the orders in the ring. This is a bit awkward so maybe there's a better solution.
                            ring.revertOrderStats();
                        }
                    }
                }
            }
        }
    }

    function emitRingMinedEvent(
        Data.Ring memory ring,
        uint _ringIndex,
        address feeRecipient
        )
        internal
    {
        bytes32 ringHash = ring.hash;
        // keccak256("RingMined(uint256,bytes32,address,bytes)")
        bytes32 ringMinedSignature = 0xb2ef4bc5209dff0c46d5dfddb2b68a23bd4820e8f33107fde76ed15ba90695c9;
        uint fillsSize = ring.size * 8 * 32;

        uint data;
        uint ptr;
        assembly {
            data := mload(0x40)
            ptr := data
            mstore(ptr, _ringIndex)                     // ring index data
            mstore(add(ptr, 32), 0x40)                  // offset to fills data
            mstore(add(ptr, 64), fillsSize)             // fills length
            ptr := add(ptr, 96)
        }
        ptr = ring.generateFills(ptr);

        assembly {
            log3(
                data,                                   // data start
                sub(ptr, data),                         // data length
                ringMinedSignature,                     // Topic 0: RingMined signature
                ringHash,                               // Topic 1: ring hash
                feeRecipient                            // Topic 2: feeRecipient
            )
        }
    }

    function setupLists(
        Data.Context memory ctx,
        Data.Order[] memory orders,
        Data.Ring[] memory rings
        )
        internal
        pure
    {
        setupTokenBurnRateList(ctx, orders);
        setupFeePaymentList(ctx, rings);
        setupTokenTransferList(ctx, rings);
    }

    function setupTokenBurnRateList(
        Data.Context memory ctx,
        Data.Order[] memory orders
        )
        internal
        pure
    {
        // Allocate enough memory to store burn rates for all tokens even
        // if every token is unique (max 2 unique tokens / order)
        uint maxNumTokenBurnRates = orders.length * 2;
        bytes32[] memory tokenBurnRates;
        assembly {
            tokenBurnRates := mload(0x40)
            mstore(tokenBurnRates, 0)                               // tokenBurnRates.length
            mstore(0x40, add(
                tokenBurnRates,
                add(32, mul(maxNumTokenBurnRates, 64))
            ))
        }
        ctx.tokenBurnRates = tokenBurnRates;
    }

    function setupFeePaymentList(
        Data.Context memory ctx,
        Data.Ring[] memory rings
        )
        internal
        pure
    {
        uint totalMaxSizeFeePayments = 0;
        for (uint i = 0; i < rings.length; i++) {
            // Up to (ringSize + 3) * 3 payments per order (because of fee sharing by miner)
            // (3 x 32 bytes for every fee payment)
            uint ringSize = rings[i].size;
            uint maxSize = (ringSize + 3) * 3 * ringSize * 3;
            totalMaxSizeFeePayments += maxSize;
        }
        // Store the data directly in the call data format as expected by batchAddFeeBalances:
        // - 0x00: batchAddFeeBalances selector (4 bytes)
        // - 0x04: parameter offset (batchAddFeeBalances has a single function parameter) (32 bytes)
        // - 0x24: length of the array passed into the function (32 bytes)
        // - 0x44: the array data (32 bytes x length)
        bytes4 batchAddFeeBalancesSelector = ctx.feeHolder.batchAddFeeBalances.selector;
        uint ptr;
        assembly {
            let data := mload(0x40)
            mstore(data, batchAddFeeBalancesSelector)
            mstore(add(data, 4), 32)
            ptr := add(data, 68)
            mstore(0x40, add(ptr, mul(totalMaxSizeFeePayments, 32)))
        }
        ctx.feeData = ptr;
        ctx.feePtr = ptr;
    }

    function setupTokenTransferList(
        Data.Context memory ctx,
        Data.Ring[] memory rings
        )
        internal
        pure
    {
        uint totalMaxSizeTransfers = 0;
        for (uint i = 0; i < rings.length; i++) {
            // Up to 4 transfers per order
            // (4 x 32 bytes for every transfer)
            uint maxSize = 4 * rings[i].size * 4;
            totalMaxSizeTransfers += maxSize;
        }
        // Store the data directly in the call data format as expected by batchTransfer:
        // - 0x00: batchTransfer selector (4 bytes)
        // - 0x04: parameter offset (batchTransfer has a single function parameter) (32 bytes)
        // - 0x24: length of the array passed into the function (32 bytes)
        // - 0x44: the array data (32 bytes x length)
        bytes4 batchTransferSelector = ctx.delegate.batchTransfer.selector;
        uint ptr;
        assembly {
            let data := mload(0x40)
            mstore(data, batchTransferSelector)
            mstore(add(data, 4), 32)
            ptr := add(data, 68)
            mstore(0x40, add(ptr, mul(totalMaxSizeTransfers, 32)))
        }
        ctx.transferData = ptr;
        ctx.transferPtr = ptr;
    }

    function updateOrdersStats(
        Data.Context memory ctx,
        Data.Order[] memory orders
        )
        internal
    {
        // Store the data directly in the call data format as expected by batchUpdateFilled:
        // - 0x00: batchUpdateFilled selector (4 bytes)
        // - 0x04: parameter offset (batchUpdateFilled has a single function parameter) (32 bytes)
        // - 0x24: length of the array passed into the function (32 bytes)
        // - 0x44: the array data (32 bytes x length)
        // For every (valid) order we store 2 words:
        // - order.hash
        // - order.filledAmountS after all rings
        bytes4 batchUpdateFilledSelector = ctx.tradeHistory.batchUpdateFilled.selector;
        address _tradeHistoryAddress = address(ctx.tradeHistory);
        assembly {
            let data := mload(0x40)
            mstore(data, batchUpdateFilledSelector)
            mstore(add(data, 4), 32)
            let ptr := add(data, 68)
            let arrayLength := 0
            for { let i := 0 } lt(i, mload(orders)) { i := add(i, 1) } {
                let order := mload(add(orders, mul(add(i, 1), 32)))
                let filledAmount := mload(add(order, 928))                               // order.filledAmountS
                let initialFilledAmount := mload(add(order, 960))                        // order.initialFilledAmountS
                let filledAmountChanged := iszero(eq(filledAmount, initialFilledAmount))
                // if (order.valid && filledAmountChanged)
                if and(gt(mload(add(order, 992)), 0), filledAmountChanged) {             // order.valid
                    mstore(add(ptr,   0), mload(add(order, 864)))                        // order.hash
                    mstore(add(ptr,  32), filledAmount)

                    ptr := add(ptr, 64)
                    arrayLength := add(arrayLength, 2)
                }
            }

            // Only do the external call if the list is not empty
            if gt(arrayLength, 0) {
                mstore(add(data, 36), arrayLength)      // filledInfo.length

                let success := call(
                    gas,                                // forward all gas
                    _tradeHistoryAddress,               // external address
                    0,                                  // wei
                    data,                               // input start
                    sub(ptr, data),                     // input length
                    data,                               // output start
                    0                                   // output length
                )
                if eq(success, 0) {
                    // Propagate the revert message
                    returndatacopy(0, 0, returndatasize())
                    revert(0, returndatasize())
                }
            }
        }
    }

    function batchGetFilledAndCheckCancelled(
        Data.Context memory ctx,
        Data.Order[] memory orders
        )
        internal
    {
        // Store the data in the call data format as expected by batchGetFilledAndCheckCancelled:
        // - 0x00: batchGetFilledAndCheckCancelled selector (4 bytes)
        // - 0x04: parameter offset (batchGetFilledAndCheckCancelled has a single function parameter) (32 bytes)
        // - 0x24: length of the array passed into the function (32 bytes)
        // - 0x44: the array data (32 bytes x length)
        // For every order we store 5 words:
        // - order.broker
        // - order.owner
        // - order.hash
        // - order.validSince
        // - The trading pair of the order: order.tokenS ^ order.tokenB
        bytes4 batchGetFilledAndCheckCancelledSelector = ctx.tradeHistory.batchGetFilledAndCheckCancelled.selector;
        address _tradeHistoryAddress = address(ctx.tradeHistory);
        assembly {
            let data := mload(0x40)
            mstore(data, batchGetFilledAndCheckCancelledSelector)
            mstore(add(data,  4), 32)
            mstore(add(data, 36), mul(mload(orders), 5))                // orders.length
            let ptr := add(data, 68)
            for { let i := 0 } lt(i, mload(orders)) { i := add(i, 1) } {
                let order := mload(add(orders, mul(add(i, 1), 32)))     // orders[i]
                mstore(add(ptr,   0), mload(add(order, 320)))           // order.broker
                mstore(add(ptr,  32), mload(add(order,  32)))           // order.owner
                mstore(add(ptr,  64), mload(add(order, 864)))           // order.hash
                mstore(add(ptr,  96), mload(add(order, 192)))           // order.validSince
                // bytes20(order.tokenS) ^ bytes20(order.tokenB)        // tradingPair
                mstore(add(ptr, 128), mul(
                    xor(
                        mload(add(order, 64)),                 // order.tokenS
                        mload(add(order, 96))                  // order.tokenB
                    ),
                    0x1000000000000000000000000)               // shift left 12 bytes (bytes20 is padded on the right)
                )
                ptr := add(ptr, 160)                                    // 5 * 32
            }
            // Return data is stored just like the call data without the signature:
            // 0x00: Offset to data
            // 0x20: Array length
            // 0x40: Array data
            let returnDataSize := mul(add(2, mload(orders)), 32)
            let success := call(
                gas,                                // forward all gas
                _tradeHistoryAddress,               // external address
                0,                                  // wei
                data,                               // input start
                sub(ptr, data),                     // input length
                data,                               // output start
                returnDataSize                      // output length
            )
            // Check if the call was successful and the return data is the expected size
            if or(eq(success, 0), iszero(eq(returndatasize(), returnDataSize))) {
                if eq(success, 0) {
                    // Propagate the revert message
                    returndatacopy(0, 0, returndatasize())
                    revert(0, returndatasize())
                }
                revert(0, 0)
            }
            for { let i := 0 } lt(i, mload(orders)) { i := add(i, 1) } {
                let order := mload(add(orders, mul(add(i, 1), 32)))     // orders[i]
                let fill := mload(add(data,  mul(add(i, 2), 32)))       // fills[i]
                mstore(add(order, 928), fill)                           // order.filledAmountS
                mstore(add(order, 960), fill)                           // order.initialFilledAmountS
                // If fills[i] == ~uint(0) the order was cancelled
                // order.valid = order.valid && (order.filledAmountS != ~uint(0))
                mstore(add(order, 992),                                 // order.valid
                    and(
                        gt(mload(add(order, 992)), 0),                  // order.valid
                        iszero(eq(fill, not(0)))                        // fill != ~uint(0
                    )
                )
            }
        }
    }

    function batchBrokerTransferTokens(Data.Context memory ctx, Data.Order[] memory orders) internal {
        Data.BrokerInterceptorReport[] memory reportQueue = new Data.BrokerInterceptorReport[](orders.length);
        uint reportCount = 0;

        for (uint i = 0; i < ctx.numBrokerActions; i++) {
            Data.BrokerAction memory action = ctx.brokerActions[i];
            Data.BrokerApprovalRequest memory request = Data.BrokerApprovalRequest({
                orders: new Data.BrokerOrder[](action.numOrders),
                tokenS: action.tokenS,
                tokenB: action.tokenB,
                feeToken: action.feeToken,
                totalFillAmountB: 0,
                totalRequestedAmountS: 0,
                totalRequestedFeeAmount: 0
            });
            
            for (uint b = 0; b < action.numOrders; b++) {
                request.orders[b] = ctx.brokerOrders[action.orderIndices[b]];
                request.totalFillAmountB += request.orders[b].fillAmountB;
                request.totalRequestedAmountS += request.orders[b].requestedAmountS;
                request.totalRequestedFeeAmount += request.orders[b].requestedFeeAmount;
            }

            bool requiresReport = IBrokerDelegate(action.broker).brokerRequestAllowance(request);
            
            if (requiresReport) {
                for (uint k = 0; k < request.orders.length; k++) {
                    reportQueue[reportCount] = Data.BrokerInterceptorReport({
                        owner: request.orders[k].owner,
                        broker: action.broker,
                        orderHash: request.orders[k].orderHash,
                        tokenB: action.tokenB,
                        tokenS: action.tokenS,
                        feeToken: action.feeToken,
                        fillAmountB: request.orders[k].fillAmountB,
                        spentAmountS: request.orders[k].requestedAmountS,
                        spentFeeAmount: request.orders[k].requestedFeeAmount,
                        tokenRecipient: request.orders[k].tokenRecipient,
                        extraData: request.orders[k].extraData
                    });
                    reportCount += 1;
                }
            }

            for (uint j = 0; j < action.numTransfers; j++) {
                Data.BrokerTransfer memory transfer = ctx.brokerTransfers[action.transferIndices[j]];

                if (transfer.recipient != action.broker) {
                    require(transfer.token.safeTransferFrom(
                        action.broker, 
                        transfer.recipient, 
                        transfer.amount
                    ), TRANSFER_FAILURE);
                }
            }
        }

        for (uint m = 0; m < reportCount; m++) {
            IBrokerDelegate(reportQueue[m].broker).onOrderFillReport(reportQueue[m]);
        }
    }

    function batchTransferTokens(
        Data.Context memory ctx
        )
        internal
    {
        // Check if there are any transfers
        if (ctx.transferData == ctx.transferPtr) {
            return;
        }
        // We stored the token transfers in the call data as expected by batchTransfer.
        // The only thing we still need to do is update the final length of the array and call
        // the function on the TradeDelegate contract with the generated data.
        address _tradeDelegateAddress = address(ctx.delegate);
        uint arrayLength = (ctx.transferPtr - ctx.transferData) / 32;
        uint data = ctx.transferData - 68;
        uint ptr = ctx.transferPtr;
        assembly {
            mstore(add(data, 36), arrayLength)      // batch.length

            let success := call(
                gas,                                // forward all gas
                _tradeDelegateAddress,              // external address
                0,                                  // wei
                data,                               // input start
                sub(ptr, data),                     // input length
                data,                               // output start
                0                                   // output length
            )
            if eq(success, 0) {
                // Propagate the revert message
                returndatacopy(0, 0, returndatasize())
                revert(0, returndatasize())
            }
        }
    }

    function batchPayFees(
        Data.Context memory ctx
        )
        internal
    {
        // Check if there are any fee payments
        if (ctx.feeData == ctx.feePtr) {
            return;
        }
        // We stored the fee payments in the call data as expected by batchAddFeeBalances.
        // The only thing we still need to do is update the final length of the array and call
        // the function on the FeeHolder contract with the generated data.
        address _feeHolderAddress = address(ctx.feeHolder);
        uint arrayLength = (ctx.feePtr - ctx.feeData) / 32;
        uint data = ctx.feeData - 68;
        uint ptr = ctx.feePtr;
        assembly {
            mstore(add(data, 36), arrayLength)      // batch.length

            let success := call(
                gas,                                // forward all gas
                _feeHolderAddress,                  // external address
                0,                                  // wei
                data,                               // input start
                sub(ptr, data),                     // input length
                data,                               // output start
                0                                   // output length
            )
            if eq(success, 0) {
                // Propagate the revert message
                returndatacopy(0, 0, returndatasize())
                revert(0, returndatasize())
            }
        }
    }

}
