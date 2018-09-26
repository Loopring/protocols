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
pragma solidity 0.4.24;
pragma experimental "v0.5.0";
pragma experimental "ABIEncoderV2";

import "../iface/Errors.sol";
import "../iface/IBrokerRegistry.sol";
import "../iface/IRingSubmitter.sol";
import "../iface/IFeeHolder.sol";
import "../iface/IOrderRegistry.sol";
import "../iface/ITradeDelegate.sol";
import "../iface/IOrderBook.sol";
import "../iface/IBurnRateTable.sol";

import "../lib/BytesUtil.sol";
import "../lib/MathUint.sol";
import "../lib/NoDefaultFunc.sol";

import "../spec/EncodeSpec.sol";
import "../spec/MiningSpec.sol";
import "../spec/OrderSpecs.sol";
import "../spec/RingSpecs.sol";

import "../helper/InputsHelper.sol";
import "../helper/MiningHelper.sol";
import "../helper/OrderHelper.sol";
import "../helper/RingHelper.sol";

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
contract RingSubmitter is IRingSubmitter, NoDefaultFunc, Errors {
    using MathUint      for uint;
    using BytesUtil     for bytes;
    using MiningSpec    for uint16;
    using EncodeSpec    for uint16[];
    using OrderSpecs    for uint16[];
    using RingSpecs     for uint8[][];
    using OrderHelper     for Data.Order;
    using RingHelper      for Data.Ring;
    using InputsHelper    for Data.Inputs;
    using MiningHelper    for Data.Mining;

    address public  lrcTokenAddress             = 0x0;
    address public  wethTokenAddress            = 0x0;
    address public  delegateAddress             = 0x0;
    address public  orderBrokerRegistryAddress  = 0x0;
    address public  minerBrokerRegistryAddress  = 0x0;
    address public  orderRegistryAddress        = 0x0;
    address public  feeHolderAddress            = 0x0;
    address public  orderBookAddress            = 0x0;
    address public  burnRateTableAddress        = 0x0;

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
        address _orderBrokerRegistryAddress,
        address _minerBrokerRegistryAddress,
        address _orderRegistryAddress,
        address _feeHolderAddress,
        address _orderBookAddress,
        address _burnRateTableAddress
        )
        public
    {
        require(_lrcTokenAddress != 0x0, ZERO_ADDRESS);
        require(_wethTokenAddress != 0x0, ZERO_ADDRESS);
        require(_delegateAddress != 0x0, ZERO_ADDRESS);
        require(_orderBrokerRegistryAddress != 0x0, ZERO_ADDRESS);
        require(_minerBrokerRegistryAddress != 0x0, ZERO_ADDRESS);
        require(_orderRegistryAddress != 0x0, ZERO_ADDRESS);
        require(_feeHolderAddress != 0x0, ZERO_ADDRESS);
        require(_orderBookAddress != 0x0, ZERO_ADDRESS);
        require(_burnRateTableAddress != 0x0, ZERO_ADDRESS);

        lrcTokenAddress = _lrcTokenAddress;
        wethTokenAddress = _wethTokenAddress;
        delegateAddress = _delegateAddress;
        orderBrokerRegistryAddress = _orderBrokerRegistryAddress;
        minerBrokerRegistryAddress = _minerBrokerRegistryAddress;
        orderRegistryAddress = _orderRegistryAddress;
        feeHolderAddress = _feeHolderAddress;
        orderBookAddress = _orderBookAddress;
        burnRateTableAddress = _burnRateTableAddress;
    }

    function submitRings(
        bytes data
        )
        external
    {
        Data.Context memory ctx = Data.Context(
            lrcTokenAddress,
            ITradeDelegate(delegateAddress),
            IBrokerRegistry(orderBrokerRegistryAddress),
            IBrokerRegistry(minerBrokerRegistryAddress),
            IOrderRegistry(orderRegistryAddress),
            IFeeHolder(feeHolderAddress),
            IOrderBook(orderBookAddress),
            IBurnRateTable(burnRateTableAddress),
            ringIndex,
            FEE_PERCENTAGE_BASE
        );

        // Check if the highest bit of ringIndex is '1'
        require((ctx.ringIndex >> 63) == 0, REENTRY);

        // Set the highest bit of ringIndex to '1' (IN STORAGE!)
        ringIndex = ctx.ringIndex | (1 << 63);

        (
            Data.Mining  memory mining,
            Data.Order[] memory orders,
            Data.Ring[]  memory rings
        ) = ExchangeDeserializer.deserialize(lrcTokenAddress, data);

        for (uint i = 0; i < orders.length; i++) {
            orders[i].validateInfo(ctx);
            orders[i].checkP2P();
            orders[i].updateHash();
            orders[i].updateBrokerAndInterceptor(ctx);
        }
        batchGetFilledAndCheckCancelled(ctx, orders);
        for (uint i = 0; i < orders.length; i++) {
            orders[i].checkBrokerSignature(ctx);
        }

        for (uint i = 0; i < rings.length; i++) {
            rings[i].updateHash();
        }

        mining.updateHash(rings);
        mining.updateMinerAndInterceptor(ctx);
        require(mining.checkMinerSignature(), INVALID_SIG);

        for (uint i = 0; i < orders.length; i++) {
            orders[i].checkDualAuthSignature(mining.hash);
        }

        for (uint i = 0; i < rings.length; i++){
            Data.Ring memory ring = rings[i];
            ring.checkOrdersValid();
            ring.checkForSubRings();
            ring.calculateFillAmountAndFee(ctx);
            if (ring.valid) {
                // Only settle rings we have checked to be valid
                ring.settleRing(ctx, mining);
                IRingSubmitter.Fill[] memory fills = ring.generateFills();
                emit RingMined(
                    ctx.ringIndex++,
                    ring.hash,
                    mining.feeRecipient,
                    fills
                );
            } else {
                emit InvalidRing(ring.hash);
            }
        }
        updateOrdersStats(ctx, orders);

        ringIndex = ctx.ringIndex;
    }

    function updateOrdersStats(Data.Context ctx, Data.Order[] orders) internal {
        bytes4 batchUpdateFilledSelector = ctx.delegate.batchUpdateFilled.selector;
        address tradeDelegateAddress = address(ctx.delegate);
        assembly {
            let data := mload(0x40)
            mstore(data, batchUpdateFilledSelector)
            mstore(add(data, 4), 32)
            let ptr := add(data, 68)
            let size := 0
            for { let i := 0 } lt(i, mload(orders)) { i := add(i, 1) } {
                let order := mload(add(orders, mul(add(i, 1), 32)))
                if gt(mload(add(order, 960)), 0) {
                    mstore(add(ptr,   0), mload(add(order, 864)))  // hash
                    mstore(add(ptr,  32), mload(add(order, 928)))  // filledAmountS

                    ptr := add(ptr, 64)
                    size := add(size, 2)
                }
            }
            mstore(add(data, 36), size)             // length

            let success := call(
                gas,                                // forward all gas
                tradeDelegateAddress,               // external address
                0,                                  // wei
                data,                               // input start
                sub(ptr, data),                     // input length
                data,                               // output start
                32                                  // output length
            )
            if eq(success, 0) {
                revert(0, 0)
            }
        }
    }

    function batchGetFilledAndCheckCancelled(Data.Context ctx, Data.Order[] orders)
        internal
    {
        bytes4 batchGetFilledAndCheckCancelledSelector = ctx.delegate.batchGetFilledAndCheckCancelled.selector;
        address tradeDelegateAddress = address(ctx.delegate);
        assembly {
            let data := mload(0x40)
            mstore(data, batchGetFilledAndCheckCancelledSelector)
            mstore(add(data,  4), 32)
            mstore(add(data, 36), mul(mload(orders), 5))       // length
            let ptr := add(data, 68)
            for { let i := 0 } lt(i, mload(orders)) { i := add(i, 1) } {
                let order := mload(add(orders, mul(add(i, 1), 32)))
                mstore(add(ptr,   0), mload(add(order, 288)))  // broker
                mstore(add(ptr,  32), mload(add(order,   0)))  // owner
                mstore(add(ptr,  64), mload(add(order, 864)))  // hash
                mstore(add(ptr,  96), mload(add(order, 160)))  // validSince
                mstore(add(ptr, 128), mul(
                    xor(
                        mload(add(order, 32)),                 // tokenS
                        mload(add(order, 64))                  // tokenB
                    ),
                    0x1000000000000000000000000)               // shift left 12 bytes
                )
                ptr := add(ptr, 160)                           // 5 * 32
            }
            // Return data is stored just like the call data without the signature:
            // 0x00: Offset to data
            // 0x20: Array length
            // 0x40: Array data
            let returnDataSize := mul(add(2, mload(orders)), 32)
            let success := call(
                gas,                                // forward all gas
                tradeDelegateAddress,               // external address
                0,                                  // wei
                data,                               // input start
                sub(ptr, data),                     // input length
                data,                               // output start
                returnDataSize                      // output length
            )
            if or(eq(success, 0), sub(1, eq(returndatasize(), returnDataSize)))  {
                revert(0, 0)
            }
            for { let i := 0 } lt(i, mload(orders)) { i := add(i, 1) } {
                let order := mload(add(orders, mul(add(i, 1), 32)))
                let fill := mload(add(data,  mul(add(i, 2), 32)))
                mstore(add(order, 928), fill)                           // filledAmountS
                // order.valid = order.valid && (order.filledAmountS != ~uint(0));
                mstore(add(order, 960),                                 // valid
                    and(
                        gt(mload(add(order, 960)), 0),
                        sub(1, eq(fill, not(0)))
                    )
                )
            }
        }
    }

}
