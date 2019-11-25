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


/// @title QuotaTransfers
contract TokenBalances is BaseModule
{
    function staticMethods()
        public
        pure
        returns (bytes4[] memory methods)
    {
        methods = new bytes4[](2);
        methods[0] = this.tokenBalance.selector;
        methods[1] = this.tokenBalances.selector;
    }

    function tokenBalance(
        address token
        )
        public
        view
        returns (uint)
    {
        if (token == address(0)) {
            return address(this).balance;
        } else {
            return ERC20(token).balanceOf(address(this));
        }
    }

    function tokenBalances(
        address[] memory tokens
        )
        public
        view
        returns (uint[] memory balances)
    {
        balances = new uint[](tokens.length);
        for (uint i = 0; i < tokens.length; i++) {
            balances[i] = tokenBalance(tokens[i]);
        }
    }
}
