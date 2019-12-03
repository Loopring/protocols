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
pragma experimental ABIEncoderV2;

import "../../lib/ERC20.sol";

import "../../base/BaseModule.sol";
import "../../base/BaseSubAccount.sol";


/// @title TokenBalances
contract TokenBalances is BaseSubAccount, BaseModule
{
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
        require(balance >= 0, "INVALID_BALANCE");
    }

    function deposit (address, address[] calldata, address, uint) external { revert("UNSUPPORTED"); }
    function withdraw(address, address[] calldata, address, uint) external { revert("UNSUPPORTED"); }
    function getWithdrawalable (address, address ) public view returns (uint) { return 0; }
    function getDepositable (address, address) public view returns (uint ) { return 0; }
}
