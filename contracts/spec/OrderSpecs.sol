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

import "../helper/InputsHelper.sol";
import "../impl/Data.sol";
import "./OrderSpec.sol";


/// @title An Implementation of IOrderbook.
/// @author Daniel Wang - <daniel@loopring.org>.
library OrderSpecs {
    using OrderSpec for uint16;
    using InputsHelper for Data.Inputs;

    function assembleOrders(
        uint16[] specs,
        Data.Inputs inputs
        )
        public
        pure
        returns (Data.Order[] memory orders)
    {
        uint size = specs.length;
        orders = new Data.Order[](size);
        for (uint i = 0; i < size; i++) {
            orders[i] = assembleOrder(specs[i], inputs);
        }
    }

    function assembleOrder(
        uint16 spec,
        Data.Inputs inputs
        )
        internal
        pure
        returns (Data.Order memory)
    {
        return Data.Order(
            inputs.nextAddress(), // owner
            inputs.nextAddress(), // tokenS
            address(0x0),         // tokenB
            inputs.nextUint(),    // amountS
            inputs.nextUint(),    // amountB
            inputs.nextUint(),    // lrcFee
            spec.hasDualAuth() ? inputs.nextAddress() : address(0x0),
            spec.hasBroker() ? inputs.nextAddress() : address(0x0),
            spec.hasOrderInterceptor() ? inputs.nextAddress() : address(0x0),
            spec.hasWallet() ? inputs.nextAddress() : address(0x0),
            spec.hasValidSince() ? inputs.nextUint() : 0,
            spec.hasValidUntil() ? inputs.nextUint() : uint(0) - 1,
            spec.hasSignature() ? inputs.nextBytes() : new bytes(0),
            spec.hasDualAuth() ? inputs.nextBytes() : new bytes(0),
            spec.limitByAmountB(),
            spec.allOrNone(),
            bytes32(0x0), // hash
            address(0x0), // orderBrokerInterceptor
            0,  // spendableLRC
            0,  // maxAmountS
            0,  // maxAmountB,
            false // sellLRC
        );
    }
}