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

import "../../lib/ERC20.sol";

import "../../base/BaseModule.sol";

import "../../iface/SubAccount.sol";


/// @title TokenBalances
contract TokenBalances is BaseModule, SubAccount
{
    function subAccountName()
        public
        pure
        returns (string memory)
    {
        return "main";
    }

    function boundMethods()
        public
        pure
        returns (bytes4[] memory methods)
    {
        methods = new bytes4[](2);
        methods[0] = this.tokenBalance.selector;
        methods[1] = this.tokenBalances.selector;
    }

    function tokenBalance(
        address wallet,
        address token
        )
        public
        view
        returns (int balance)
    {
        if (token == address(0)) {
            balance = int(wallet.balance);
        } else {
            balance = int(ERC20(token).balanceOf(wallet));
        }

        require(balance >=0, "INVALID_BALANCE");
    }

    function tokenBalances(
        address   wallet,
        address[] memory tokens
        )
        public
        view
        returns (int[] memory balances)
    {
        balances = new int[](tokens.length);
        for (uint i = 0; i < tokens.length; i++) {
            balances[i] = tokenBalance(wallet, tokens[i]);
        }
    }
}
