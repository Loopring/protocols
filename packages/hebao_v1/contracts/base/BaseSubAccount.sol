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
import "../lib/MathInt.sol";

import "../iface/SubAccount.sol";


/// @title BaseSubAccount
contract BaseSubAccount is SubAccount
{
    using MathInt for int;

    event SubAccountTransfer(
        address indexed wallet,
        address indexed token,
        int             amount // positive for transfering into this sub-account
                               // or negavite for transfering out of this sub-account.
    );

    struct SubAccountStat
    {
        int totalDeposit;
        int totalWithdrawal;
    }

    mapping (address => mapping(address => SubAccountStat)) private stats;


    function trackDeposit(
        address wallet,
        address token,
        uint    amount
        )
        internal
    {
        int _amount = int(amount);
        require(_amount >= 0, "INVALID_AMOUNT");
        // solium-disable-next-line operator-whitespace
        stats[wallet][token].totalDeposit =
            stats[wallet][token].totalDeposit.add(_amount);

        emit SubAccountTransfer(wallet, token, _amount);
    }

    function trackWithdrawal(
        address wallet,
        address token,
        uint    amount
        )
        internal
    {
        int _amount = int(amount);
        require(_amount >= 0, "INVALID_AMOUNT");
        // solium-disable-next-line operator-whitespace
        stats[wallet][token].totalWithdrawal =
            stats[wallet][token].totalWithdrawal.add(_amount);

        emit SubAccountTransfer(wallet, token, -_amount);
    }

    function tokenReturn (
        address wallet,
        address token
        )
        public
        view
        returns (int)
    {
        int totalDeposit = stats[wallet][token].totalDeposit;
        if (totalDeposit == 0) return 0;

        int totalWithdrawal = stats[wallet][token].totalWithdrawal;
        int totalReturn = tokenBalance(wallet, token).add(totalWithdrawal);
        int earned = totalReturn.sub(totalDeposit);

        return earned.mul(10000) / totalDeposit;
    }

    function tokenReturnAmount (
        address wallet,
        address token
        )
        public
        view
        returns (int)
    {
        int totalDeposit = stats[wallet][token].totalDeposit;

        if (totalDeposit == 0) return 0;

        int totalWithdrawal = stats[wallet][token].totalWithdrawal;
        int totalReturn = tokenBalance(wallet, token).add(totalWithdrawal);
        return totalReturn.sub(totalDeposit);
    }

    /// @dev The default implementation returns the total's balance or 0.
    function tokenWithdrawalable (
        address wallet,
        address token
        )
        public
        view
        returns (uint)
    {
        int balance = tokenBalance(wallet, token);
        return balance <= 0 ? 0 : uint(balance);
    }

    /// @dev The default implementation returns the wallet's balance.
    function tokenDepositable (
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

    function tokenInterestRate(address, address, address) public view returns (int) { return 0; }

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