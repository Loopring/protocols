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


/// @title IDepositContract.
///        Contract storing and transferring funds for an exchange.
/// @author Brecht Devos - <brecht@loopring.org>
contract IDepositContract
{
    /// @dev Transfers tokens from a user to the exchange.
    ///
    ///      This function can only be called by the exchange.
    ///
    /// @param from The address of the account that sends the tokens.
    /// @param token The address of the token to transfer (`0x0` for ETH).
    /// @param amount The amount of tokens transferred.
    function deposit(
        address from,
        address token,
        uint amount
        )
        external
        payable;

    /// @dev Transfers tokens from the exchange to a user.
    ///
    ///      This function can only be called by the exchange.
    ///
    /// @param to The address to which 'amount' tokens are transferred.
    /// @param token The address of the token to transfer (`0x0` for ETH).
    /// @param amount The amount of tokens transferred.
    function withdraw(
        address to,
        address token,
        uint amount
        )
        external;

    /// @dev Transfers tokens for a user using the allowance set for the exchange.
    ///      This way the approval can be used for all functionality (and
    ///      extended functionality) of the exchange.
    ///
    ///      This function can only be called by the exchange.
    ///
    /// @param from The address of the account that sends the tokens.
    /// @param to The address to which 'amount' tokens are transferred.
    /// @param token The address of the token to transfer (ETH is and cannot be suppported).
    /// @param amount The amount of tokens transferred.
    function transfer(
        address from,
        address to,
        address token,
        uint    amount
        )
        external;
}