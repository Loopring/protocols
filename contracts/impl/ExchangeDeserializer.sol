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
        uint version = uint16(MemoryUtil.bytesToUintX(data, 0, 2) & 0xFFFF);
        inputs.numOrders = uint16(MemoryUtil.bytesToUintX(data, 2, 2) & 0xFFFF);
        inputs.numRings = uint16(MemoryUtil.bytesToUintX(data, 4, 2) & 0xFFFF);
        uint16 numSpendables = uint16(MemoryUtil.bytesToUintX(data, 6, 2) & 0xFFFF);
        require(numSpendables > 0, "Invalid number of spendables");

        uint ordersOffset = 8;
        uint ringsOffset = ordersOffset + (3 + 26 * inputs.numOrders) * 2;
        uint dataOffset = ringsOffset + inputs.numRings * 9 + 32;

        assembly {
            mstore(add(inputs,  0), add(data, add(ordersOffset, 2)))
            mstore(add(inputs, 32), add(data, add(ringsOffset, 1)))
            mstore(add(inputs, 64), add(data, dataOffset))
        }

        Data.Spendable[] memory spendableList = new Data.Spendable[](numSpendables);
        return inputToStructedData(
            version,
            lrcTokenAddress,
            inputs,
            spendableList
        );
    }

    function inputToStructedData(
        uint version,
        address lrcTokenAddress,
        Data.Inputs inputs,
        Data.Spendable[] memory spendableList
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
        bytes memory data = inputs.data;
        bytes memory emptyBytes = new bytes(0);

        uint numOrders = inputs.numOrders;
        uint orderSize = 32 * 32;
        uint arrayDataSize = (numOrders + 1) * 32;

        uint numSpendables = spendableList.length;

        bytes memory tablesPtr = inputs.tablesPtr;
        uint offset;

        assembly {
            /* Setup mining */

            // Default for feeRecipient
            mstore(add(data, 20), origin)

            // feeRecipient
            offset := and(mload(add(tablesPtr,  0)), 0xFFFF)
            mstore(
                add(mining,   0),
                mload(add(add(data, 20), offset))
            )

            // Restore default to 0
            mstore(add(data, 20), 0)

            // miner
            offset := and(mload(add(tablesPtr,  2)), 0xFFFF)
            mstore(
                add(mining,  32),
                mload(add(add(data, 20), offset))
            )

            // Default empty bytes array
            mstore(add(data, 32), emptyBytes)

            // sig
            offset := and(mload(add(tablesPtr,  4)), 0xFFFF)
            mstore(
                add(mining, 64),
                add(data, add(offset, 32))
            )

            // Restore default to 0
            mstore(add(data, 32), 0)

            // Advance table pointer to start of orders
            tablesPtr := add(tablesPtr, 6)

            /* Setup orders */

            // Allocate memory for all orders
            orders := mload(0x40)
            mstore(add(orders, 0), numOrders)
            mstore(0x40, add(orders, add(arrayDataSize, mul(orderSize, numOrders))))

            for { i := 0 } lt(i, numOrders) { i := add(i, 1) } {
                let order := add(orders, add(arrayDataSize, mul(orderSize, i)))

                // Store the memory location of this order in the orders array
                mstore(add(orders, mul(add(i, 1), 32)), order)

                // version
                offset := and(mload(add(tablesPtr,  0)), 0xFFFF)
                mstore(
                    add(order,   0),
                    offset
                )

                // Owner
                offset := and(mload(add(tablesPtr,  2)), 0xFFFF)
                mstore(
                    add(order,  32),
                    and(mload(add(add(data, 20), offset)), 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
                )

                // tokenS
                offset := and(mload(add(tablesPtr,  4)), 0xFFFF)
                mstore(
                    add(order,  64),
                    and(mload(add(add(data, 20), offset)), 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
                )

                // amountS
                offset := and(mload(add(tablesPtr,  6)), 0xFFFF)
                mstore(
                    add(order, 128),
                    mload(add(add(data, 32), offset))
                )

                // amountB
                offset := and(mload(add(tablesPtr,  8)), 0xFFFF)
                mstore(
                    add(order, 160),
                    mload(add(add(data, 32), offset))
                )

                // validSince
                offset := and(mload(add(tablesPtr, 10)), 0xFFFF)
                mstore(
                    add(order, 192),
                    mload(add(add(data, 32), offset))
                )

                // tokenSpendableS
                offset := and(mload(add(tablesPtr, 12)), 0xFFFF)
                // Force the spendable index to 0 if it's invalid
                // offset := mul(offset, lt(offset, numSpendables))
                mstore(
                    add(order, 224),
                    mload(add(spendableList, mul(add(offset, 1), 32)))
                )

                // tokenSpendableFee
                offset := and(mload(add(tablesPtr, 14)), 0xFFFF)
                // Force the spendable index to 0 if it's invalid
                // offset := mul(offset, lt(offset, numSpendables))
                mstore(
                    add(order, 256),
                    mload(add(spendableList, mul(add(offset, 1), 32)))
                )

                // dualAuthAddr
                offset := and(mload(add(tablesPtr, 16)), 0xFFFF)
                mstore(
                    add(order, 288),
                    and(mload(add(add(data, 20), offset)), 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
                )

                // broker
                offset := and(mload(add(tablesPtr, 18)), 0xFFFF)
                mstore(
                    add(order, 320),
                    and(mload(add(add(data, 20), offset)), 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
                )

                // brokerSpendableS
                offset := and(mload(add(tablesPtr, 20)), 0xFFFF)
                mstore(
                    add(order, 352),
                    mload(add(spendableList, mul(add(offset, 1), 32)))
                )

                // brokerSpendableFee
                offset := and(mload(add(tablesPtr, 22)), 0xFFFF)
                mstore(
                    add(order, 384),
                    mload(add(spendableList, mul(add(offset, 1), 32)))
                )

                // orderInterceptor
                offset := and(mload(add(tablesPtr, 24)), 0xFFFF)
                mstore(
                    add(order, 416),
                    and(mload(add(add(data, 20), offset)), 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
                )

                // wallet
                offset := and(mload(add(tablesPtr, 26)), 0xFFFF)
                mstore(
                    add(order, 448),
                    and(mload(add(add(data, 20), offset)), 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
                )

                // validUntil
                offset := and(mload(add(tablesPtr, 28)), 0xFFFF)
                mstore(
                    add(order, 480),
                    mload(add(add(data, 32), offset))
                )

                // Default value sig and dualAuthSig
                mstore(add(data, 32), emptyBytes)

                // sig
                offset := and(mload(add(tablesPtr, 30)), 0xFFFF)
                mstore(
                    add(order, 512),
                    add(data, add(offset, 32))
                )

                // dualAuthSig
                offset := and(mload(add(tablesPtr, 32)), 0xFFFF)
                mstore(
                    add(order, 544),
                    add(data, add(offset, 32))
                )

                // Restore default to 0
                mstore(add(data, 32), 0)

                // allOrNone
                offset := and(mload(add(tablesPtr, 34)), 0xFFFF)
                mstore(
                    add(order, 576),
                    gt(offset, 0)
                )

                // lrcTokenAddress is the default value for feeToken
                mstore(add(data, 20), lrcTokenAddress)

                // feeToken
                offset := and(mload(add(tablesPtr, 36)), 0xFFFF)
                mstore(
                    add(order, 608),
                    and(mload(add(add(data, 20), offset)), 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
                )

                // Restore default to 0
                mstore(add(data, 20), 0)

                // feeAmount
                offset := and(mload(add(tablesPtr, 38)), 0xFFFF)
                mstore(
                    add(order, 640),
                    mload(add(add(data, 32), offset))
                )

                // feePercentage
                offset := and(mload(add(tablesPtr, 40)), 0xFFFF)
                mstore(
                    add(order, 672),
                    offset
                )

                // waiveFeePercentage
                offset := and(mload(add(tablesPtr, 42)), 0xFFFF)
                mstore(
                    add(order, 704),
                    offset
                )

                // tokenSFeePercentage
                offset := and(mload(add(tablesPtr, 44)), 0xFFFF)
                mstore(
                    add(order, 736),
                    offset
                )

                // tokenBFeePercentage
                offset := and(mload(add(tablesPtr, 46)), 0xFFFF)
                mstore(
                    add(order, 768),
                    offset
                )

                // The owner is the default value of tokenRecipient
                mstore(add(data, 20), mload(add(order, 32)))

                // tokenRecipient
                offset := and(mload(add(tablesPtr, 48)), 0xFFFF)
                mstore(
                    add(order, 800),
                    and(mload(add(add(data, 20), offset)), 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
                )

                // Restore default to 0
                mstore(add(data, 20), 0)

                // walletSplitPercentage
                offset := and(mload(add(tablesPtr, 50)), 0xFFFF)
                mstore(
                    add(order, 832),
                    offset
                )

                // Set default  values
                // P2P
                mstore(add(order, 864), 0)
                // hash
                mstore(add(order, 896), 0)
                // brokerInterceptor
                mstore(add(order, 928), 0)
                // filledAmountS
                mstore(add(order, 960), 0)
                // valid
                mstore(add(order, 992), 1)

                // Advance to the next order
                tablesPtr := add(tablesPtr, 52)
            }
        }

        rings = assembleRings(inputs.ringsPtr, inputs.numRings, orders);
    }

    function assembleRings(
        bytes memory data,
        uint numRings,
        Data.Order[] orders
        )
        internal
        view
        returns (Data.Ring[] rings)
    {
        uint ringsArrayDataSize = (numRings + 1) * 32;

        assembly {
            // Allocate memory for all rings
            rings := mload(0x40)
            mstore(add(rings, 0), numRings)
            mstore(0x40, add(rings, add(ringsArrayDataSize, mul(160, numRings))))

            for { let r := 0 } lt(r, numRings) { r := add(r, 1) } {
                let ring := add(rings, add(ringsArrayDataSize, mul(160, r)))

                // Store the memory location of this ring in the rings array
                mstore(add(rings, mul(add(r, 1), 32)), ring)

                let ringSize := and(mload(data), 0xFF)
                data := add(data, 1)

                // size
                mstore(add(ring,  0), ringSize)
                // hash
                mstore(add(ring,  64), 0)
                // minerFeesToOrdersPercentage
                mstore(add(ring,  96), 0)
                // valid
                mstore(add(ring,  128), 1)

                let ringArrayDataSize := mul(add(ringSize, 1), 32)

                // Allocate memory for all orders
                let participations := mload(0x40)
                mstore(add(participations, 0), ringSize)
                mstore(0x40, add(participations, add(ringArrayDataSize, mul(320, ringSize))))

                // participations
                mstore(add(ring, 32), participations)

                for { let i := 0 } lt(i, ringSize) { i := add(i, 1) } {
                    let participation := add(participations, add(ringArrayDataSize, mul(320, i)))

                    // Store the memory location of this participation in the participations array
                    mstore(add(participations, mul(add(i, 1), 32)), participation)

                    let orderIndex := and(mload(data), 0xFF)
                    data := add(data, 1)

                    // order
                    mstore(
                        add(participation,   0),
                        mload(add(orders, mul(add(orderIndex, 1), 32)))
                    )

                    // Set default  values
                    // splitS
                    mstore(add(participation,  32), 0)
                    // feeAmount
                    mstore(add(participation,  64), 0)
                    // feeAmountS
                    mstore(add(participation,  96), 0)
                    // feeAmountB
                    mstore(add(participation, 128), 0)
                    // rebateFee
                    mstore(add(participation, 160), 0)
                    // rebateS
                    mstore(add(participation, 192), 0)
                    // rebateB
                    mstore(add(participation, 224), 0)
                    // fillAmountS
                    mstore(add(participation, 256), 0)
                    // fillAmountB
                    mstore(add(participation, 288), 0)
                }

                // Set tokenB of orders using the tokenS from the next order
                for { let i := 0 } lt(i, ringSize) { i := add(i, 1) } {
                    let participation := add(participations, add(ringArrayDataSize, mul(320, i)))
                    let participationNext := add(participations, add(
                        ringArrayDataSize,
                        mul(320, addmod(i, 1, ringSize))
                    ))

                    mstore(
                        add(mload(participation),  96),
                        mload(add(mload(participationNext),  64))
                    )
                }

                // Advance to next ring
                data := add(data, sub(8, ringSize))
            }
        }
    }
}
