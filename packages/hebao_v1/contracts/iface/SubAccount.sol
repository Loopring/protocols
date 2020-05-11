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
pragma solidity ^0.6.6;
pragma experimental ABIEncoderV2;


/// @title SubAccount
abstract contract SubAccount
{
    /// @dev Deposits Ether/token from the wallet to this sub-account.
    ///      The method must throw in case of error, or must emit a SubAccountTransfer event.
    /// @param wallet The wallt from which the Ether/token will be transfered out.
    /// @param token The token address, use 0x0 for Ether.
    /// @param amount The amount of Ether/token to transfer.
    function deposit(
        address            wallet,
        address            token,
        uint               amount
        )
        external
        virtual;

    /// @dev Withdraw Ether/token from this sub-account to the wallet.
    ///      The method must throw in case of error, or must emit a SubAccountTransfer event.
    /// @param wallet The wallt to which the Ether/token will be transfered to.
    /// @param token The token address, use 0x0 for Ether.
    /// @param amount The amount of Ether/token to transfer.
    function withdraw(
        address            wallet,
        address            token,
        uint               amount
        )
        external
        virtual;

    /// @dev Returns a wallet's token balance in this sub-account.
    /// @param wallet The wallet's address.
    /// @param token The token's address, use 0x0 for Ether.
    /// @param balance The balance. A negative balance indiciates a loan.
    function tokenBalance (
        address wallet,
        address token
        )
        public
        view
        virtual
        returns (int balance);

    /// @dev Returns the amount of token a wallet can withdraw from the sub-account
    ///      to the wallet. The return value may be smaller than the balance to
    /// indicate lockup or bigger than the balance to indicate a credit.
    ///
    /// @param wallet The wallet's address.
    /// @param token The token's address, use 0x0 for Ether.
    /// @return unsupported True if the token is supported, else false.
    /// @return withdrawable The amount allowed to withdraw.
    function tokenWithdrawalable (
        address wallet,
        address token
        )
        public
        view
        virtual
        returns (bool unsupported, uint withdrawable);

    /// @dev Returns the amount of token a wallet can deposit from the wallet into
    ///      the sub-account. uint(-1) will be returned if there is no limitation.
    /// @param wallet The wallet's address.
    /// @param token The token's address, use 0x0 for Ether.
    /// @return unsupported True if the token is supported, else false.
    /// @return depositable The amount allowd to deposit.
    function tokenDepositable (
        address wallet,
        address token
        )
        public
        view
        virtual
        returns (bool unsupported, uint depositable);

    /// @dev Checks if a certain amount of withdrawal is allowed.
    /// @param wallet The wallet's address.
    /// @param token The token's address, use 0x0 for Ether.
    /// @param amount The amount to withdraw.
    /// @return True if withdrawal is allowed, false otherwise.
    function canWithdrawToken (
        address wallet,
        address token,
        uint    amount
        )
        public
        view
        virtual
        returns (bool);

    /// @dev Checks if a certain amount of deposit is allowed.
    /// @param wallet The wallet's address.
    /// @param token The token's address, use 0x0 for Ether.
    /// @param amount The amount to deposit.
    /// @return True if deposit is allowed, false otherwise.
    function canDepositToken (
        address wallet,
        address token,
        uint    amount
        )
        public
        view
        virtual
        returns (bool);

    /// @dev Returns the current interest rate in BIPs (0.01%).
    /// @param wallet The wallet's address.
    /// @param token The token's address, use 0x0 for Ether.
    /// @param amount The amount to consider.
    /// @param borrow True to query the loan interest; false to query the saving interest.
    /// @return interestRate The interest rate in BIPs. It will be >= 0 for supply
    ///         and <=0 for borrowing.
    function tokenInterestRate (
        address wallet,
        address token,
        uint    amount,
        bool    borrow
        )
        public
        view
        virtual
        returns (int interestRate);

    /// @dev Returns the ROI in BIPs (0.01%).
    /// @param wallet The wallet's address.
    /// @param token The token's address, use 0x0 for Ether.
    /// @return roi The ROI in BIPs.
    function tokenReturn (
        address wallet,
        address token
        )
        public
        view
        virtual
        returns (int roi);
}
