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


/// @title SubAccount
contract SubAccount
{
    function tokenBalance (address wallet, address token) public view returns (int);
    function tokenBalances(address wallet, address[] memory tokens) public view returns (int[] memory balances);

    /// @dev Deposits Ether/token from the wallet to this sub-account.
    function deposit (address wallet, address token, uint amount) external;

    /// @dev Withdraw Ether/token from this sub-account to the wallet.
    function withdraw(address wallet, address token, uint amount) external;
}