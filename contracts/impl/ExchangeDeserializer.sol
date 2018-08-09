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

import "../lib/AddressUtil.sol";
import "../lib/BytesUtil.sol";
import "../lib/MemoryUtil.sol";
import "../lib/ERC20.sol";
import "../lib/MathUint.sol";
import "../lib/MultihashUtil.sol";
import "../lib/NoDefaultFunc.sol";

import "../spec/EncodeSpec.sol";
import "../spec/OrderSpecs.sol";
import "../spec/MiningSpec.sol";
import "../spec/RingSpecs.sol";

import "../helper/InputsHelper.sol";
import "../helper/OrderHelper.sol";
import "../helper/RingHelper.sol";
import "../helper/MiningHelper.sol";

import "./Data.sol";


/// @title An Implementation of IExchange.
/// @author Daniel Wang - <daniel@loopring.org>,
library ExchangeDeserializer {
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

    /// @dev Submit a order-ring for validation and settlement.
    function deserialize(
        Data.Context ctx,
        bytes data
        )
        internal
        /* view */
        returns (
            Data.Mining  mining,
            Data.Order[] orders,
            Data.Ring[]  rings
        )
    {
        uint16 encodeSpecsLen = uint16(MemoryUtil.bytesToUintX(data, 0, 2));
        uint offset = 2;
        uint16[] memory encodeSpecs = data.copyToUint16Array(offset, encodeSpecsLen);
        offset += 2 * encodeSpecsLen;

        uint16 miningSpec = uint16(MemoryUtil.bytesToUintX(data, offset, 2));
        offset += 2;
        uint16[] memory orderSpecs = data.copyToUint16Array(
            offset,
            encodeSpecs.orderSpecSize()
        );
        offset += 2 * encodeSpecs.orderSpecSize();

        uint8[][] memory ringSpecs = data.copyToUint8ArrayList(offset, encodeSpecs.ringSpecSizeArray());
        offset += 1 * encodeSpecs.ringSpecsDataLen();

        address[] memory addressList = data.copyToAddressArray(offset, encodeSpecs.addressListSize());
        offset += 20 * encodeSpecs.addressListSize();

        uint[] memory uintList = data.copyToUintArray(offset, encodeSpecs.uintListSize());
        offset += 32 * encodeSpecs.uintListSize();

        bytes[] memory bytesList = data.copyToBytesArray(offset, encodeSpecs.bytesListSizeArray());

        return submitRingsInternal(
            ctx,
            miningSpec,
            orderSpecs,
            ringSpecs,
            addressList,
            uintList,
            bytesList
        );
    }

    function submitRingsInternal(
        Data.Context ctx,
        uint16 miningSpec,
        uint16[] orderSpecs,
        uint8[][] ringSpecs,
        address[] addressList,
        uint[] uintList,
        bytes[] bytesList
        )
        internal
        view
        returns (
            Data.Mining,
            Data.Order[],
            Data.Ring[]
        )
    {
        Data.Inputs memory inputs = Data.Inputs(
            addressList,
            uintList,
            bytesList,
            0, 0, 0  // current indices of addressLists, uintList, and bytesList.
        );

        Data.Mining memory mining = Data.Mining(
            (miningSpec.hasFeeRecipient() ? inputs.nextAddress() : tx.origin),
            (miningSpec.hasMiner() ? inputs.nextAddress() : address(0x0)),
            (miningSpec.hasSignature() ? inputs.nextBytes() : new bytes(0)),
            bytes32(0x0), // hash
            address(0x0)  // interceptor
        );

        Data.Order[] memory orders = orderSpecs.assembleOrders(ctx, inputs);
        Data.Ring[] memory rings = ringSpecs.assembleRings(orders, inputs);

        return (mining, orders, rings);
    }
}
