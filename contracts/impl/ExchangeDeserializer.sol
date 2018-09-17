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
import "../spec/OrderSpec.sol";
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
        address lrcTokenAddress,
        bytes data
        )
        internal
        view
        returns (
            Data.Mining,
            Data.Order[],
            Data.Ring[]
        )
    {
        Data.Inputs memory inputs;
        inputs.data = data;
        inputs.numOrders = uint16(MemoryUtil.bytesToUintX(data, 0, 2));
        inputs.numRings = uint16(MemoryUtil.bytesToUintX(data, 2, 2));
        uint16 numSpendables = uint16(MemoryUtil.bytesToUintX(data, 4, 2));
        uint16 dataLength = uint16(MemoryUtil.bytesToUintX(data, 6, 2));

        inputs.spendableList = new Data.Spendable[](numSpendables);

        uint offset = 2 * 4;
        inputs.miningSpec = uint16(MemoryUtil.bytesToUintX(data, offset, 2));
        offset += 2;
        inputs.ordersOffset = offset;
        offset += 2 * inputs.numOrders;
        inputs.bytesOffset = offset;
        offset += dataLength;

        inputs.ringsOffset = offset;

        return inputToStructedData(
            lrcTokenAddress,
            inputs
        );
    }

    function inputToStructedData(
        address lrcTokenAddress,
        Data.Inputs inputs
        )
        internal
        view
        returns (
            Data.Mining mining,
            Data.Order[] orders,
            Data.Ring[] rings
        )
    {
        uint i;

        mining.feeRecipient = inputs.miningSpec.hasFeeRecipient() ? inputs.nextAddress() : tx.origin;
        mining.miner = inputs.miningSpec.hasMiner() ? inputs.nextAddress() : address(0x0);
        mining.sig = inputs.miningSpec.hasSignature() ? inputs.nextBytes() : new bytes(0);

        orders = new Data.Order[](inputs.numOrders);
        for (i = 0; i < inputs.numOrders; i++) {
            Data.Order memory order = orders[i];
            uint16 spec = uint16(MemoryUtil.bytesToUintX(inputs.data, inputs.ordersOffset + i * 2, 2));

            order.owner = inputs.nextAddress();
            order.tokenS = inputs.nextAddress();
            order.amountS = inputs.nextUint();
            order.amountB = inputs.nextUint();
            order.validSince = inputs.nextUint();
            order.tokenSpendableS = inputs.spendableList[inputs.nextUint16()];
            order.tokenSpendableFee = inputs.spendableList[inputs.nextUint16()];
            order.dualAuthAddr = (spec & 1 != 0) ? inputs.nextAddress() : 0x0;
            if (spec & 2 != 0) {
                order.broker = inputs.nextAddress();
                order.brokerSpendableS = inputs.spendableList[inputs.nextUint16()];
                order.brokerSpendableFee = inputs.spendableList[inputs.nextUint16()];
            }
            order.orderInterceptor = (spec & 4 != 0) ? inputs.nextAddress() : 0x0;
            order.wallet = (spec & 8 != 0) ? inputs.nextAddress() : 0x0;
            order.validUntil = (spec & 16 != 0) ? inputs.nextUint() : uint(0) - 1;
            if (spec & 64 != 0) {
                order.sig = inputs.nextBytes();
            }
            if (spec & 128 != 0) {
                order.dualAuthSig = inputs.nextBytes();
            }
            order.allOrNone = (spec & 32 != 0);
            order.feeToken = (spec & 256 != 0) ? inputs.nextAddress() : lrcTokenAddress;
            order.feeAmount = (spec & 512 != 0) ? inputs.nextUint() : 0;
            order.feePercentage = (spec & 1024 != 0) ? inputs.nextUint16() : 0;
            order.waiveFeePercentage = (spec & 2048 != 0) ? int16(inputs.nextUint16()) : 0;
            order.tokenSFeePercentage = (spec & 4096 != 0) ? inputs.nextUint16() : 0;
            order.tokenBFeePercentage = (spec & 8192 != 0) ? inputs.nextUint16() : 0;
            order.tokenRecipient = (spec & 16384 != 0) ? inputs.nextAddress() : order.owner;
            order.walletSplitPercentage = (spec & 32768 != 0) ? inputs.nextUint16() : 0;
            order.valid = true;
        }

        rings = new Data.Ring[](inputs.numRings);
        for (uint r = 0; r < inputs.numRings; r++) {
            uint ringSize = uint(inputs.data[inputs.ringsOffset++]);

            Data.Ring memory ring = rings[r];
            ring.size = ringSize;
            ring.valid = true;
            ring.participations = new Data.Participation[](ringSize);
            for (i = 0; i < ringSize; i++) {
                ring.participations[i].order = orders[uint(inputs.data[inputs.ringsOffset++])];
            }

            // Set tokenB of orders using the tokenS from the next order
            for (i = 0; i < ringSize; i++) {
                ring.participations[i].order.tokenB = ring.participations[(i + 1) % ringSize].order.tokenS;
            }
        }
    }
}
