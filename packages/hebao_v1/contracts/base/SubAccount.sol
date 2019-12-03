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


/// @title SubAccount
contract SubAccount
{
    /// @dev Deposits Ether/token from the wallet to this sub-account.
    /// @param wallet The wallt from which the Ether/token will be transfered out.
    /// @param signers The list of meta-transaction signers, must be emptpy for normal transactions.
    /// @param token The token address, use 0x0 for Ether.
    /// @param amount The amount of Ether/token to transfer.
    function deposit(
        address            wallet,
        address[] calldata signers,
        address            token,
        uint               amount
        )
        external;

    /// @dev Withdraw Ether/token from this sub-account to the wallet.
    /// @param wallet The wallt to which the Ether/token will be transfered to.
    /// @param signers The list of meta-transaction signers, must be emptpy for normal transactions.
    /// @param token The token address, use 0x0 for Ether.
    /// @param amount The amount of Ether/token to transfer.
    function withdraw(
        address            wallet,
        address[] calldata signers,
        address            token,
        uint               amount
        )
        external;

    /// @dev Returns a wallet's token balance in this subaccount.
    /// @param wallet The wallet's address.
    /// @param token The token's address, use 0x0 for Ether.
    /// @param balance The balance. A negative balance indiciates a loan.
    function tokenBalance (
        address wallet,
        address token
        )
        public
        view
        returns (int balance);

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