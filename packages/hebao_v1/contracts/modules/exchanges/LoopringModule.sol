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

import "../../lib/MathUint.sol";

import "../../iface/Wallet.sol";

import "../security/SecurityModule.sol";

import "./IExchangeV3.sol";


/// @title LoopringModule
contract LoopringModule is SecurityModule
{
    using MathUint for uint;
    event AccountUpdated(
        address indexed exchange,
        address indexed wallet,
        bool            newAccount
    );

    event Deposit(
        address indexed exchange,
        address indexed wallet,
        address indexed token,
        uint96          amount
    );

    event Withdrawal(
        address indexed exchange,
        address indexed wallet,
        address indexed token,
        uint96          amount
    );

    constructor(SecurityStore _securityStore)
        public
        SecurityModule(_securityStore)
    {
    }

    function boundMethods()
        public
        pure
        returns (bytes4[] memory methods)
    {
        methods = new bytes4[](3);
        methods[0] = this.isExchangeRunning.selector;
        methods[1] = this.getDEXSlots.selector;
        methods[2] = this.getDEXAccount.selector;
    }

    function isExchangeRunning(IExchangeV3 exchange)
        public
        view
        returns (bool)
    {
        return (
            !exchange.isInMaintenance() &&
            !exchange.isInWithdrawalMode() &&
            !exchange.isShutdown()
        );
    }

    function getDEXSlots(IExchangeV3 exchange)
        public
        view
        returns (
            uint numAvailableDepositSlots,
            uint numAvailableWithdrawalSlots
        )
    {
        (,numAvailableDepositSlots, , numAvailableWithdrawalSlots) = exchange.getRequestStats();
    }

    function getDEXAccount(
        address     wallet,
        IExchangeV3 exchange
        )
        public
        view
        returns (
            uint24 accountId,
            uint   pubKeyX,
            uint   pubKeyY
        )
    {
        bytes memory callData = abi.encodeWithSelector(
            exchange.getAccount.selector,
            wallet
        );
        (bool success, bytes memory result) = address(exchange).staticcall(callData);
        if (success && result.length == 96) {
            assembly {
                accountId := mload(add(result, 32))
                pubKeyX := mload(add(result, 64))
                pubKeyY := mload(add(result, 96))
            }
        }
    }

    function createOrUpdateDEXAccount(
        address payable wallet,
        IExchangeV3     exchange,
        uint            pubKeyX,
        uint            pubKeyY,
        bytes calldata  permission
        )
        external
        nonReentrant
        onlyFromMetaTxOrWalletOwner(wallet)
        onlyWhenWalletUnlocked(wallet)
    {
        (uint fee, bool newAccount) = getAccountCreationOrUpdateFee(wallet, exchange);

        bytes memory txData = abi.encodeWithSelector(
            exchange.createOrUpdateAccount.selector,
            pubKeyX,
            pubKeyY,
            permission
        );

        transactCall(wallet, address(exchange), fee, txData);
        emit AccountUpdated(address(exchange), wallet, newAccount);
    }

    function depositToDEX(
        address payable wallet,
        IExchangeV3     exchange,
        address         token,
        uint96          amount
        )
        external
        nonReentrant
        onlyFromMetaTxOrWalletOwner(wallet)
        onlyWhenWalletUnlocked(wallet)
    {
        require(amount > 0, "ZERO_VALUE");
        (, , uint fee, ) = exchange.getFees();

        bytes memory txData = abi.encodeWithSelector(
            exchange.deposit.selector,
            token,
            amount
        );

        transactCall(wallet, address(exchange), fee, txData);
        emit Deposit(address(exchange), wallet, token, amount);
    }

    function withdrawFromDEX(
        address payable wallet,
        IExchangeV3     exchange,
        address         token,
        uint96          amount
        )
        external
        nonReentrant
        onlyFromMetaTxOrWalletOwner(wallet)
        onlyWhenWalletUnlocked(wallet)
    {
        require(amount > 0, "ZERO_VALUE");
        (, , , uint fee) = exchange.getFees();

        bytes memory txData = abi.encodeWithSelector(
            exchange.withdraw.selector,
            token,
            amount
        );

        transactCall(wallet, address(exchange), fee, txData);
        emit Withdrawal(address(exchange), wallet, token, amount);
    }


    function getAccountCreationOrUpdateFee(
        address     wallet,
        IExchangeV3 exchange
        )
        internal
        view
        returns (uint fee, bool newAccount)
    {
        (uint creationFee, uint updateFee, uint depositFee, ) = exchange.getFees();
        (uint24 accountId, ,) = getDEXAccount(wallet, exchange);

        fee = depositFee.add(accountId == 0 ? creationFee : updateFee);
        newAccount = accountId == 0;
    }

    function extractMetaTxSigners(
        address wallet,
        bytes4  method,
        bytes   memory /* data */
        )
        internal
        view
        returns (address[] memory signers)
    {
        require (
            method == this.createOrUpdateDEXAccount.selector ||
            method == this.depositToDEX.selector ||
            method == this.withdrawFromDEX.selector,
            "INVALID_METHOD"
        );

        signers = new address[](1);
        signers[0] = Wallet(wallet).owner();
    }
}
