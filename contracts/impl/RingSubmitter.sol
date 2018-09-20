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
            orders[i].checkBrokerSignature(ctx);
        }
        checkCutoffsAndCancelledOrders(ctx, orders);

        for (uint i = 0; i < rings.length; i++) {
            rings[i].updateHash();
        }

        mining.updateHash(rings);
        mining.updateMinerAndInterceptor(ctx);
        require(mining.checkMinerSignature(), INVALID_SIG);

        for (uint i = 0; i < orders.length; i++) {
            orders[i].checkDualAuthSignature(mining.hash);
            orders[i].updateStates(ctx);
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
                    0x0,
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
        bytes32[] memory ordersFilledInfo = new bytes32[](orders.length * 2);
        for (uint i = 0; i < orders.length; i++){
            Data.Order memory order = orders[i];
            ordersFilledInfo[i * 2] = order.hash;
            ordersFilledInfo[i * 2 + 1] = bytes32(order.filledAmountS);
        }
        ctx.delegate.batchUpdateFilled(ordersFilledInfo);
    }

    function checkCutoffsAndCancelledOrders(Data.Context ctx, Data.Order[] orders)
        internal
        view
    {
        TradeDelegateData.OrderCheckCancelledData memory cancelledData;
        bytes32[] memory ordersInfo = new bytes32[](orders.length * 5);
        for (uint i = 0; i < orders.length; i++) {
            Data.Order memory order = orders[i];

            // This will make writes to cancelledData to be stored in the memory of ordersInfo
            uint ptr = MemoryUtil.getBytes32Pointer(ordersInfo, 5 * i);
            assembly {
                cancelledData := ptr
            }

            cancelledData.broker = order.broker;
            cancelledData.owner = order.owner;
            cancelledData.hash = order.hash;
            cancelledData.validSince = order.validSince;
            cancelledData.tradingPair = bytes20(order.tokenS) ^ bytes20(order.tokenB);
        }

        uint ordersValid = ctx.delegate.batchCheckCutoffsAndCancelled(ordersInfo);

        for (uint i = 0; i < orders.length; i++) {
            Data.Order memory order = orders[i];
            order.valid = order.valid && ((ordersValid >> i) & 1) != 0;
        }
    }

}
