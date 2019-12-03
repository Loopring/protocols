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

import "../lib/ERC20.sol";

import "../iface/SubAccount.sol";


/// @title BaseSubAccount
contract BaseSubAccount is SubAccount
{
    event BaseSubAccountTransfer(
        address indexed wallet,
        address indexed token,
        int             amount // positive for transfering into this sub-account
                               // or negavite for transfering out of this sub-account.
    );

    /// @dev The default implementation returns the total's balance or 0.
    function getWithdrawalable (
        address wallet,
        address token
        )
        public
        view
        returns (uint withdrawalable)
    {
        int balance = tokenBalance(wallet, token);
        return balance <= 0 ? 0 : uint(balance);
    }


    /// @dev The default implementation returns the wallet's balance.
    function getDepositable (
        address wallet,
        address token
        )
        public
        view
        returns (uint withdrawalable)
    {
        if (token == address(0)) {
            return wallet.balance;
        } else {
            return ERC20(token).balanceOf(wallet);
        }
    }

    /// @dev Returns the balance for a list of tokens.
    ///
    ///      Sub-contract may want to override this method, for example, Uniswap, to
    ///      merge Ether balances from multiple trading-pairs.
    ///
    /// @param wallet The wallet's address.
    /// @param tokens The list of token addresses, use 0x0 for Ether.
    /// @return balances The list of balances. A negative balance indiciates a loan.
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