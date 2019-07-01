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

import "../iface/IExchange.sol";


contract AccountContract {

    IExchange exchange;

    uint[16] private dummyStorageVariables;

    constructor(
        address _exchangeAddress
        )
        public
    {
        exchange = IExchange(_exchangeAddress);
    }

    function updateAccountAndDeposit(
        uint    pubKeyX,
        uint    pubKeyY,
        address token,
        uint96  amount
        )
        external
        payable
        returns (
            uint24 accountID,
            bool   isAccountNew,
            bool   isAccountUpdated
        )
    {
        return exchange.updateAccountAndDeposit.value(msg.value)(pubKeyX, pubKeyY, token, amount);
    }

    function withdraw(
        address token,
        uint96 amount
        )
        external
        payable
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
