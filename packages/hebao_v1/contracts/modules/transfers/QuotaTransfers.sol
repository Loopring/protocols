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
pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "../../lib/Claimable.sol";
import "../../lib/ERC20.sol";

import "../../iface/PriceOracle.sol";
import "../../iface/Wallet.sol";

import "./TransferModule.sol";


/// @title QuotaTransfers
contract QuotaTransfers is TransferModule
{
    uint public delayPeriod;

    mapping (address => mapping(bytes32 => uint)) public pendingTransactions;

    event PendingTxCreated   (address indexed wallet, bytes32 indexed txid, uint timestamp);
    event PendingTxExecuted  (address indexed wallet, bytes32 indexed txid, uint timestamp);
    event PendingTxCancelled (address indexed wallet, bytes32 indexed txid);

    constructor(
        Controller  _controller,
        uint        _delayPeriod
        )
        public
        TransferModule(_controller)
    {
        delayPeriod = _delayPeriod;
    }

    function boundMethods()
        public
        pure
        override
        returns (bytes4[] memory methods)
    {
        methods = new bytes4[](1);
        methods[0] = this.isPendingTxUsable.selector;
    }

    function transferToken(
        address        wallet,
        address        token,
        address        to,
        uint           amount,
        bytes calldata logdata,
        bool           enablePending
        )
        external
        nonReentrant
        onlyWhenWalletUnlocked(wallet)
        onlyFromMetaTxOrWalletOwner(wallet)
        returns (bytes32 pendingTxId)
    {
        bytes32 txid = keccak256(
            abi.encodePacked(
                "__TRANSFER__",
                wallet,
                token,
                to,
                amount,
                keccak256(logdata)
            )
        );

        bool isPendingTx = isPendingTxUsable(wallet, txid);
        if (isPendingTx) {
            emit PendingTxExecuted(wallet, txid, now);
            delete pendingTransactions[wallet][txid];
            transferInternal(wallet, token, to, amount, logdata);
            return 0x0;
        }

        (bool whitelisted,) = controller.whitelistStore().isWhitelisted(wallet, to);
        if (whitelisted) {
            transferInternal(wallet, token, to, amount, logdata);
            return 0x0;
        }

        bool withinQuota = tryToUpdateQuota(wallet, token, amount);
        if (withinQuota) {
            transferInternal(wallet, token, to, amount, logdata);
            return 0x0;
        }

        if (enablePending) {
            createPendingTx(wallet, txid);
            return txid;
        } else {
            revert("QUOTA_EXCEEDED");
        }
    }

    function callContract(
        address            wallet,
        address            to,
        uint               value,
        bytes     calldata data,
        bool               enablePending
        )
        external
        nonReentrant
        onlyWhenWalletUnlocked(wallet)
        onlyFromMetaTxOrWalletOwner(wallet)
        returns (bytes32 pendingTxId)
    {
        bytes32 txid = keccak256(
            abi.encodePacked(
                "__CALL_CONTRACT__",
                wallet,
                to,
                value,
                keccak256(data)
            )
        );

        bool isPendingTx = isPendingTxUsable(wallet, txid);
        if (isPendingTx) {
            emit PendingTxExecuted(wallet, txid, now);
            delete pendingTransactions[wallet][txid];
            callContractInternal(wallet, to, value, data);
            return 0x0;
        }

        (bool whitelisted,) = controller.whitelistStore().isWhitelisted(wallet, to);
        if (whitelisted) {
            callContractInternal(wallet, to, value, data);
            return 0x0;
        }

        bool withinQuota = tryToUpdateQuota(wallet, address(0), value);
        if (withinQuota) {
            callContractInternal(wallet, to, value, data);
            return 0x0;
        }

        if (enablePending) {
            createPendingTx(wallet, txid);
            return txid;
        } else {
            revert("QUOTA_EXCEEDED");
        }
    }

    function transferTokensFullBalance(
        address            wallet,
        address[] calldata tokens,
        address            to,
        bytes calldata     logdata
        )
        external
        nonReentrant
        onlyWhenWalletUnlocked(wallet)
        onlyFromMetaTxOrWalletOwner(wallet)
    {
        (bool allowed,) = controller.whitelistStore().isWhitelisted(wallet, to);
        require(allowed, "PROHIBITED");

        for (uint i = 0; i < tokens.length; i++) {
            address token = tokens[i];
            uint amount = (token == address(0)) ?
                wallet.balance : ERC20(token).balanceOf(wallet);
            transferInternal(wallet, token, to, amount, logdata);
        }
    }

    function approveToken(
        address            wallet,
        address            token,
        address            to,
        uint               amount
        )
        external
        nonReentrant
        onlyWhenWalletUnlocked(wallet)
        onlyFromMetaTxOrWalletOwner(wallet)
    {
        (bool whitelisted,) = controller.whitelistStore().isWhitelisted(wallet, to);
        if (whitelisted) {
            approveInternal(wallet, token, to, amount);
            return;
        }

        uint allowance = ERC20(token).allowance(wallet, to);
        if (allowance >= amount) {
            approveInternal(wallet, token, to, amount);
            return;
        }

        updateQuota(wallet, token, amount.sub(allowance));
        approveInternal(wallet, token, to, amount);
    }

    function approveThenCallContract(
        address            wallet,
        address            token,
        address            to,
        uint               amount,
        bytes     calldata data
        )
        external
        nonReentrant
        onlyWhenWalletUnlocked(wallet)
        onlyFromMetaTxOrWalletOwner(wallet)
    {
        (bool allowed,) = controller.whitelistStore().isWhitelisted(wallet, to);
        if (allowed) {
            approveInternal(wallet, token, to, amount);
            callContractInternal(wallet, to, 0, data);
            return;
        }

        uint allowance = ERC20(token).allowance(wallet, to);
        if (allowance >= amount) {
            approveInternal(wallet, token, to, amount);
            callContractInternal(wallet, to, 0, data);
            return;
        }

        updateQuota(wallet, token, amount.sub(allowance));
        approveInternal(wallet, token, to, amount);
        callContractInternal(wallet, to, 0, data);
    }

    function cancelPendingTx(
        address wallet,
        bytes32 pendingTxId
        )
        external
        nonReentrant
        onlyWhenWalletUnlocked(wallet)
        onlyFromMetaTxOrWalletOwner(wallet)
    {
        require(pendingTransactions[wallet][pendingTxId] != 0, "NOT_FOUND");
        pendingTransactions[wallet][pendingTxId] = 0;
        emit PendingTxCancelled(wallet, pendingTxId);
    }

    function isPendingTxUsable(
        address wallet,
        bytes32 pendingTxId
        )
        public
        view
        returns (bool)
    {
        uint timestamp = pendingTransactions[wallet][pendingTxId];
        return timestamp > 0 && now >= timestamp;
    }

    function extractMetaTxSigners(
        address wallet,
        bytes4  method,
        bytes   memory  /* data */
        )
        internal
        view
        override
        returns (address[] memory signers)
    {
        require (
            method == this.transferToken.selector ||
            method == this.transferTokensFullBalance.selector ||
            method == this.approveToken.selector ||
            method == this.callContract.selector ||
            method == this.approveThenCallContract.selector ||
            method == this.cancelPendingTx.selector,
            "INVALID_METHOD"
        );

        signers = new address[](1);
        signers[0] = Wallet(wallet).owner();
    }

    function createPendingTx(
        address wallet,
        bytes32 txid
        )
        private
    {
        require(pendingTransactions[wallet][txid] == 0, "DUPLICATE_PENDING_TX");
        uint timestampUsable = now.add(delayPeriod);
        pendingTransactions[wallet][txid] = timestampUsable;
        emit PendingTxCreated(wallet, txid, timestampUsable);
    }

    function callContractInternal(
        address wallet,
        address to,
        uint    value,
        bytes   memory txData
        )
        internal
        override
    {
        // Disallow general calls to token contracts (for tokens that have price data
        // so the quota is actually used).
        require(controller.priceOracle().tokenPrice(to, 1e18) == 0, "CALL_DISALLOWED");
        super.callContractInternal(wallet, to, value, txData);
    }
}
