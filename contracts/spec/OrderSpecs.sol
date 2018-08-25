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
        Data.Context ctx,
        Data.Inputs inputs
        )
        internal
        pure
        returns (Data.Order[] memory orders)
    {
        uint size = specs.length;
        orders = new Data.Order[](size);
        for (uint i = 0; i < size; i++) {
            orders[i] = assembleOrder(ctx, specs[i], inputs);
        }
    }

    function assembleOrder(
        Data.Context ctx,
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
            inputs.nextUint(),    // validSince
            inputs.spendableList[inputs.nextUint16()],       // tokenSpendableS
            inputs.spendableList[inputs.nextUint16()],       // tokenSpendableFee
            spec.hasDualAuth() ? inputs.nextAddress() : 0x0,
            spec.hasBroker() ? inputs.nextAddress() : 0x0,
            spec.hasBroker() ? inputs.spendableList[inputs.nextUint16()] : Data.Spendable(true, 0, 0),
            spec.hasBroker() ? inputs.spendableList[inputs.nextUint16()] : Data.Spendable(true, 0, 0),
            spec.hasOrderInterceptor() ? inputs.nextAddress() : 0x0,
            spec.hasWallet() ? inputs.nextAddress() : 0x0,
            spec.hasValidUntil() ? inputs.nextUint() : uint(0) - 1,
            spec.hasSignature() ? inputs.nextBytes() : new bytes(0),
            spec.hasDualAuthSig() ? inputs.nextBytes() : new bytes(0),
            spec.allOrNone(),
            spec.hasFeeToken() ? inputs.nextAddress() : ctx.lrcTokenAddress,
            spec.hasFeeAmount() ? inputs.nextUint() : 0,
            spec.hasFeePercentage() ? inputs.nextUint16() : 0,
            spec.hasWaiveFeePercentage() ? int16(inputs.nextUint16()) : 0,
            spec.hasTokenSFeePercentage() ? inputs.nextUint16() : 0,
            spec.hasTokenBFeePercentage() ? inputs.nextUint16() : 0,
            bytes32(0x0), // hash
            0x0, // orderBrokerInterceptor
            0,  // filledAmountS
            true   // valid
        );
    }
}
