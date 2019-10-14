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

import "../iface/IExchangeInterfaceV30.sol";
import "./MyExchangeV10Storage.sol";
import "../lib/Refundable.sol";


/// @title MyExchangeV10
/// @dev Exchange frontend built on Loopring v3
///      This is the main entry point to the exchange for users and agents.
///      To keep the address of the exchange constant this contract should
///      be used with a proxy.
/// @author Brecht Devos - <brecht@loopring.org>
contract MyExchangeV10 is MyExchangeV10Storage, Refundable
{
    modifier onlyWhenUninitialized()
    {
        require(exchange == IExchangeV3(0), "INITIALIZED");
        _;
    }

    function initialize(
        IExchangeV3               _exchange,
        IDepositModule            _depositModule,
        IOnchainWithdrawalModule  _onchainWithdrawalModule,
        IInternalTransferModule   _internalTransferModule
        )
        public
        onlyWhenUninitialized
    {
        require(exchange != IExchangeV3(0), "ZERO_VALUE");
        exchange = _exchange;
        depositModule = _depositModule;
        onchainWithdrawalModule = _onchainWithdrawalModule;
        internalTransferModule = _internalTransferModule;
    }

    function createOrUpdateAccount(
        address owner,
        uint    pubKeyX,
        uint    pubKeyY,
        bytes   calldata permission
        )
        external
        payable
        onlyAuthorizedFor(owner)
        refund
        returns (
            uint24,
            bool,
            bool
        )
    {
        return depositModule.createOrUpdateAccount(
            owner,
            pubKeyX,
            pubKeyY,
            permission
        );
    }

    function createOrUpdateAccount(
        uint    pubKeyX,
        uint    pubKeyY,
        bytes   calldata permission
        )
        external
        payable
        refund
        returns (
            uint24,
            bool,
            bool
        )
    {
        return depositModule.createOrUpdateAccount(
            msg.sender,
            pubKeyX,
            pubKeyY,
            permission
        );
    }

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
        onlyAuthorizedFor(owner)
        refund
        returns (
            uint24 accountID,
            bool   isAccountNew,
            bool   isAccountUpdated
        )
    {
        return depositModule.updateAccountAndDeposit(
            owner,
            pubKeyX,
            pubKeyY,
            tokenAddress,
            amount,
            permission
        );
    }

    function updateAccountAndDeposit(
        uint    pubKeyX,
        uint    pubKeyY,
        address tokenAddress,
        uint96  amount,
        bytes   calldata permission
        )
        external
        payable
        refund
        returns (
            uint24 accountID,
            bool   isAccountNew,
            bool   isAccountUpdated
        )
    {
        return depositModule.updateAccountAndDeposit(
            msg.sender,
            pubKeyX,
            pubKeyY,
            tokenAddress,
            amount,
            permission
        );
    }

    function deposit(
        address tokenAddress,
        uint96  amount
        )
        external
        payable
        refund
    {
        depositModule.deposit(
            msg.sender,
            msg.sender,
            tokenAddress,
            amount
        );
    }

    function depositTo(
        address to,
        address tokenAddress,
        uint96  amount
        )
        external
        payable
        refund
    {
        depositModule.deposit(
            msg.sender,
            to,
            tokenAddress,
            amount
        );
    }

    function deposit(
        address from,
        address to,
        address tokenAddress,
        uint96  amount
        )
        external
        payable
        onlyAuthorizedFor(from)
        refund
    {
        depositModule.deposit(
            from,
            to,
            tokenAddress,
            amount
        );
    }

    function withdraw(
        address owner,
        address tokenAddress,
        uint96 amount
        )
        external
        payable
        onlyAuthorizedFor(owner)
        refund
    {
        onchainWithdrawalModule.withdraw(
            owner,
            tokenAddress,
            amount
        );
    }

    function withdraw(
        address tokenAddress,
        uint96 amount
        )
        external
        payable
        refund
    {
        onchainWithdrawalModule.withdraw(
            msg.sender,
            tokenAddress,
            amount
        );
    }

    function approveConditionalTransfer(
        address from,
        address to,
        address token,
        uint24  fAmount,
        address feeToken,
        uint24  fFee,
        uint32  salt
        )
        external
        onlyAuthorizedFor(from)
    {
        internalTransferModule.approveConditionalTransfer(
            from,
            to,
            token,
            fAmount,
            feeToken,
            fFee,
            salt
        );
    }

    function onchainTransferFrom(
        address token,
        address from,
        address to,
        uint    amount
        )
        external
        onlyAuthorizedFor(from)
    {
        internalTransferModule.onchainTransferFrom(
            token,
            from,
            to,
            amount
        );
    }
}
