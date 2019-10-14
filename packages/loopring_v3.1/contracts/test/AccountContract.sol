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
pragma solidity ^0.5.11;

import "../iface/IExchangeInterfaceV30.sol";

import "../lib/MathUint.sol";
import "../lib/Refundable.sol";


contract AccountContract is Refundable {
    using MathUint          for uint;

    IExchangeInterfaceV30 exchange;

    uint[16] private dummyStorageVariables;

    constructor(
        address _exchangeAddress
        )
        public
    {
        exchange = IExchangeInterfaceV30(_exchangeAddress);
    }

    function updateAccountAndDeposit(
        uint    pubKeyX,
        uint    pubKeyY,
        address token,
        uint96  amount,
        bytes   calldata permission
        )
        external
        payable
        refund
        returns (
            uint24,
            bool,
            bool
        )
    {
        return exchange.updateAccountAndDeposit.value(msg.value)(
            pubKeyX,
            pubKeyY,
            token,
            amount,
            permission
        );
    }

    function withdraw(
        address token,
        uint96 amount
        )
        external
        payable
        refund
    {
        exchange.withdraw.value(msg.value)(token, amount);
    }

    function()
        external
        payable
    {
        // Some expensive operation
        for (uint i = 0; i < 16; i++) {
            dummyStorageVariables[i] = block.number;
        }
    }
}
