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

import "../../lib/ERC20.sol";

import "../../iface/Wallet.sol";

import "../stores/ReimbursementStore.sol";

import "../security/SecurityModule.sol";

import "./IExchangeV3.sol";


/// @title ExchangeModule
contract ExchangeModule is SecurityModule
{
    event AccountUpdated(
        address indexed exchange,
        address indexed wallet,
        bool            creation
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

    ReimbursementStore internal reimbursementStore;

    constructor(
        SecurityStore      _securityStore,
        ReimbursementStore _reimbursementStore
        )
        public
        SecurityModule(_securityStore)
    {
        reimbursementStore = _reimbursementStore;
    }

    function staticMethods()
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

    function getDEXAccount(IExchangeV3 exchange)
        public
        view
        returns (
            uint24 accountId,
            uint   pubKeyX,
            uint   pubKeyY
        )
    {
        return exchange.getAccount(address(this));
    }

    function createOrUpdateDEXAccount(
        address payable wallet,
        IExchangeV3     exchange,
        uint            pubKeyX,
        uint            pubKeyY,
        bytes calldata  permission,
        address         feeToken,
        uint            feeAmount
        )
        external
        nonReentrantExceptFromThis
        onlyFromMetaTxOrWalletOwner(wallet)
        onlyWhenWalletUnlocked(wallet)
    {
        (uint creationFee, uint updateFee, , ) = exchange.getFees();
        (uint24 accountId, , ) = exchange.getAccount(wallet);

        uint fee = accountId == 0 ? creationFee : updateFee;
        checkAndReimburse(wallet, fee, feeToken, feeAmount);

        bytes memory callData = abi.encodeWithSelector(
            exchange.createOrUpdateAccount.selector,
            pubKeyX,
            pubKeyY,
            permission
        );

        transact(wallet, address(exchange), fee, callData);
        emit AccountUpdated(address(exchange), wallet, accountId == 0);
    }

    function depositToDEX(
        address payable wallet,
        IExchangeV3     exchange,
        address         token,
        uint96          amount,
        address         feeToken,
        uint            feeAmount
        )
        external
        nonReentrantExceptFromThis
        onlyFromMetaTxOrWalletOwner(wallet)
        onlyWhenWalletUnlocked(wallet)
    {
        require(amount > 0, "ZERO_VALUE");
        (, , uint fee, ) = exchange.getFees();
        checkAndReimburse(wallet, fee, feeToken, feeAmount);

        bytes memory callData = abi.encodeWithSelector(
            exchange.deposit.selector,
            token,
            amount
        );

        transact(wallet, address(exchange), fee, callData);
        emit Deposit(address(exchange), wallet, token, amount);
    }

    function withdrawFromDEX(
        address payable wallet,
        IExchangeV3     exchange,
        address         token,
        uint96          amount,
        address         feeToken,
        uint            feeAmount
        )
        external
        nonReentrantExceptFromThis
        onlyFromMetaTxOrWalletOwner(wallet)
        onlyWhenWalletUnlocked(wallet)
    {
        require(amount > 0, "ZERO_VALUE");
        (, , , uint fee) = exchange.getFees();
        checkAndReimburse(wallet, fee, feeToken, feeAmount);

        bytes memory callData = abi.encodeWithSelector(
            exchange.withdraw.selector,
            token,
            amount
        );

        transact(wallet, address(exchange), fee, callData);
        emit Withdrawal(address(exchange), wallet, token, amount);
    }

    function checkAndReimburse(
        address payable wallet,
        uint            etherFee,
        address         feeToken,
        uint            feeAmount
        )
        private
    {
        if (wallet.balance >= etherFee) return;

        uint reimbursement = etherFee - wallet.balance;
        require(msg.value >= reimbursement, "INSUFFCIENT_FEE");

        uint surplus = msg.value - reimbursement;
        if (surplus > 0) {
            msg.sender.transfer(surplus);
        }
        wallet.transfer(reimbursement);

        if (feeToken == address(0) || feeAmount == 0 || msg.sender == wallet) {
            reimbursementStore.checkAndUpdate(wallet, reimbursement);
        } else {
            bytes memory callData = abi.encodeWithSelector(
                ERC20_TRANSFER,
                msg.sender,
                feeAmount
            );
            transact(wallet, feeToken, 0, callData);
        }
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
