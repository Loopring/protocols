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

import "./Data.sol";


/// @title An public library for deserializing loopring submitRings params.
/// @author Daniel Wang - <daniel@loopring.org>,
library PublicExchangeDeserializer {
    using MathUint      for uint;
    using BytesUtil     for bytes;
    using MiningSpec    for uint16;
    using EncodeSpec    for uint16[];
    using OrderSpecs    for uint16[];
    using RingSpecs     for uint8[][];
    using InputsHelper    for Data.Inputs;

    address public constant LRC_TOKEN_ADDRESS = 0xEF68e7C694F40c8202821eDF525dE3782458639f;

    /// @dev Submit a order-ring for validation and settlement.
    function deserialize(
        bytes data
        )
        public
        view
        returns (
            Data.Mining,
            Data.Order[],
            Data.Ring[]
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

        Data.Inputs memory inputs;
        // inputs.data = data;
        // inputs.addressOffset = offset;
        // offset += 20 * encodeSpecs.addressListSize();
        // inputs.uintOffset = offset;
        // offset += 32 * encodeSpecs.uintListSize();
        // inputs.uint16Offset = offset;
        // offset += 2 * encodeSpecs.uint16ListSize();
        // inputs.bytesList = data.copyToBytesArray(offset, encodeSpecs.bytesListSizeArray());
        // inputs.spendableList = new Data.Spendable[](encodeSpecs.spendableListSize());

        return inputToStructedData(
            miningSpec,
            orderSpecs,
            ringSpecs,
            inputs
        );
    }

    function inputToStructedData(
        uint16 miningSpec,
        uint16[] orderSpecs,
        uint8[][] ringSpecs,
        Data.Inputs inputs
        )
        internal
        view
        returns (
            Data.Mining,
            Data.Order[],
            Data.Ring[]
        )
    {
        Data.Mining memory mining = Data.Mining(
            (miningSpec.hasFeeRecipient() ? inputs.nextAddress() : tx.origin),
            (miningSpec.hasMiner() ? inputs.nextAddress() : address(0x0)),
            (miningSpec.hasSignature() ? inputs.nextBytes() : new bytes(0)),
            bytes32(0x0), // hash
            address(0x0)  // interceptor
        );

        Data.Order[] memory orders = orderSpecs.assembleOrders(LRC_TOKEN_ADDRESS, inputs);
        Data.Ring[] memory rings = ringSpecs.assembleRings(orders);

        return (mining, orders, rings);
    }
}
