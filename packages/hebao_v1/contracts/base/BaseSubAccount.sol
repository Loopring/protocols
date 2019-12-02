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

import "../iface/BankRegistry.sol";
import "../iface/Module.sol";
import "../iface/SubAccount.sol";

import "../lib/ERC20.sol";


contract BaseSubAccount is SubAccount
{
    // TODO(daniel) make sure this is initialized
    BankRegistry internal bankRegistry;

    event SubAccountTransfer(
        address indexed wallet,
        address indexed token,
        address         from,
        address         to,
        uint            amount
    );

    /// @dev Transfers Ether or token from this sub-account module to another sub-account module.
    function subAccountTransfer(
        address payable wallet,
        address payable destSubAccount,
        address         token,
        uint            amount
        )
        internal
    {
        require(
            bankRegistry.isModuleRegistered(destSubAccount) &&
            Module(destSubAccount).supportSubAccount(),
            "PROHIBITED"
        );

        if (token == address(0)) {
            destSubAccount.transfer(amount);
        } else {
            require(
                ERC20(token).transfer(destSubAccount, amount),
                "TOKEN_TRANSFER_FAILED"
            );
        }
        SubAccount(destSubAccount).onReceiveToken(wallet, token, address(this), amount);
        emit SubAccountTransfer(wallet, token, address(this), destSubAccount, amount);
    }
}