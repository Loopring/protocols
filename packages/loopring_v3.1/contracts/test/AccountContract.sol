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

import "../iface/IExchangeV3.sol";

import "../lib/MathUint.sol";


contract AccountContract {

    using MathUint          for uint;

    IExchangeV3 exchange;

    uint[16] private dummyStorageVariables;

    constructor(
        address _exchangeAddress
        )
        public
    {
        exchange = IExchangeV3(_exchangeAddress);
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
        returns (
            uint24 accountID,
            bool   isAccountNew,
            bool   isAccountUpdated
        )
    {
        // Send surplus to msg.sender
        /*uint balanceBefore = address(this).balance.sub(msg.value);
        (accountID, isAccountNew, isAccountUpdated) = exchange.updateAccountAndDeposit.value(msg.value)(
            pubKeyX,
            pubKeyY,
            token,
            amount,
            permission
        );
        uint balanceAfter = address(this).balance;
        msg.sender.transfer(balanceAfter.sub(balanceBefore));*/
    }

    function withdraw(
        address token,
        uint96 amount
        )
        external
        payable
    {
        // Send surplus to msg.sender
        /*uint balanceBefore = address(this).balance.sub(msg.value);
        exchange.withdraw.value(msg.value)(token, amount);
        uint balanceAfter = address(this).balance;
        msg.sender.transfer(balanceAfter.sub(balanceBefore));*/
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
