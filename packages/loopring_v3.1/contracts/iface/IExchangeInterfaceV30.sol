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


/// @title IExchangeInterfaceV30
/// @dev Standard interface for an exchange built on Loopring v3
/// @author Brecht Devos - <brecht@loopring.org>
contract IExchangeInterfaceV30
{
    function createOrUpdateAccountFor(
        address owner,
        uint    pubKeyX,
        uint    pubKeyY,
        bytes   calldata permission
        )
        external
        payable
        returns (
            uint24 accountID,
            bool   isAccountNew,
            bool   isAccountUpdated
        );

    function createOrUpdateAccount(
        uint    pubKeyX,
        uint    pubKeyY,
        bytes   calldata permission
        )
        external
        payable
        returns (
            uint24 accountID,
            bool   isAccountNew,
            bool   isAccountUpdated
        );

    function updateAccountAndDepositFor(
        address owner,
        uint    pubKeyX,
        uint    pubKeyY,
        address tokenAddress,
        uint96  amount,
        bytes   calldata permission
        )
        external
        payable
        returns (
            uint24 accountID,
            bool   isAccountNew,
            bool   isAccountUpdated
        );

    function updateAccountAndDeposit(
        uint    pubKeyX,
        uint    pubKeyY,
        address tokenAddress,
        uint96  amount,
        bytes   calldata permission
        )
        external
        payable
        returns (
            uint24 accountID,
            bool   isAccountNew,
            bool   isAccountUpdated
        );

    function depositTo(
        address to,
        address tokenAddress,
        uint96  amount
        )
        external
        payable;

    function depositForTo(
        address from,
        address to,
        address tokenAddress,
        uint96  amount
        )
        external
        payable;

    function deposit(
        address tokenAddress,
        uint96  amount
        )
        external
        payable;

    function withdrawFor(
        address owner,
        address tokenAddress,
        uint96 amount
        )
        external
        payable;

    function withdraw(
        address tokenAddress,
        uint96 amount
        )
        external
        payable;

    function approveConditionalTransfer(
        address from,
        address to,
        address token,
        uint24  fAmount,
        address feeToken,
        uint24  fFee,
        uint32  salt
        )
        external;

    function onchainTransferFrom(
        address token,
        address from,
        address to,
        uint    amount
        )
        external;
}
