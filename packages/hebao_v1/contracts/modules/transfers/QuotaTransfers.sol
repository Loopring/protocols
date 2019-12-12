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
pragma solidity ^0.5.13;
pragma experimental ABIEncoderV2;

import "../../lib/Claimable.sol";
import "../../lib/ERC20.sol";

import "../../iface/PriceOracle.sol";
import "../../iface/Wallet.sol";

import "./TransferModule.sol";


/// @title QuotaTransfers
contract QuotaTransfers is TransferModule
{
    uint public pendingExpiry;

    mapping (address => mapping(bytes32 => uint)) pendingTransactions;

    event PendingTxCreated   (address indexed wallet, bytes32 indexed txid, uint timestamp);
    event PendingTxExecuted  (address indexed wallet, bytes32 indexed txid, uint timestamp);
    event PendingTxCancelled (address indexed wallet, bytes32 indexed txid);
    event PriceOracleUpdated (address indexed priceOracle);

    constructor(
        Controller  _controller,
        uint        _pendingExpiry
        )
        public
        TransferModule(_controller)
    {
        pendingExpiry = _pendingExpiry;
    }

    function boundMethods()
        public
        pure
        returns (bytes4[] memory methods)
    {
        methods = new bytes4[](1);
        methods[0] = this.isPendingTxValid.selector;
    }

    function isPendingTxValid(
        address wallet,
        bytes32 pendingTxId)
        public
        view
        returns (bool)
    {
        return isPendingTxValidInternal(wallet, pendingTxId);
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
        onlyFromMetaTxOrWalletOwner(wallet)
        onlyWhenWalletUnlocked(wallet)
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

        bool foundPendingTx = authorizeWalletOwnerAndPendingTx(wallet, txid);
        (bool allowed,) = controller.whitelistStore().isWhitelisted(wallet, to);
        if (!allowed) {
            controller.quotaManager().checkAndAddToSpent(wallet, token, amount);
            allowed = true;
        }

        if (allowed) {
            transferInternal(wallet, token, to, amount, logdata);
            if (foundPendingTx) {
                delete pendingTransactions[wallet][txid];
            }
        } else if (enablePending) {
            require(!foundPendingTx, "DUPLICATE_PENDING");
            pendingTxId = txid;

            pendingTransactions[wallet][txid] = now;
            emit PendingTxCreated(wallet, txid, now);
        } else {
            revert("FAILED");
        }
    }

    function callContract(
        address            wallet,
        address            to,
        uint               amount,
        bytes     calldata data,
        bool               enablePending
        )
        external
        nonReentrant
        onlyFromMetaTxOrWalletOwner(wallet)
        onlyWhenWalletUnlocked(wallet)
        returns (bytes32 pendingTxId)
    {
        bytes32 txid = keccak256(
            abi.encodePacked(
                "__CALL_CONTRACT__",
                wallet,
                to,
                amount,
                keccak256(data)
            )
        );

        bool foundPendingTx = authorizeWalletOwnerAndPendingTx(wallet, txid);
        require(
            foundPendingTx || msg.sender == Wallet(wallet).owner(),
            "UNAUTHORIZED"
        );

        (bool allowed,) = controller.whitelistStore().isWhitelisted(wallet, to);
        if (!allowed) {
            controller.quotaManager().checkAndAddToSpent(wallet, address(0), amount);
            allowed = true;
        }

        if (allowed) {
            callContractInternal(wallet, to, amount, data);
            if (foundPendingTx) {
                delete pendingTransactions[wallet][txid];
            }
        } else if (enablePending) {
            require(!foundPendingTx, "DUPLICATE_PENDING");
            pendingTxId = txid;

            pendingTransactions[wallet][txid] = now;
            emit PendingTxCreated(wallet, txid, now);
        } else {
            revert("FAILED");
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
        onlyFromMetaTxOrWalletOwner(wallet)
        onlyWhenWalletUnlocked(wallet)
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
        onlyFromMetaTxOrWalletOwner(wallet)
        onlyWhenWalletUnlocked(wallet)
    {
        (bool allowed,) = controller.whitelistStore().isWhitelisted(wallet, to);
        if (allowed) {
            approveInternal(wallet, token, to, amount);
            return;
        }

        uint allowance = ERC20(token).allowance(wallet, to);
        if (allowance >= amount) {
            approveInternal(wallet, token, to, amount);
            return;
        }

        allowance = amount - allowance;
        controller.quotaManager().checkAndAddToSpent(wallet, token, allowance);
        approveInternal(wallet, token, to, allowance);
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
        onlyFromMetaTxOrWalletOwner(wallet)
        onlyWhenWalletUnlocked(wallet)
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

        allowance = amount - allowance;

        controller.quotaManager().checkAndAddToSpent(wallet, token, allowance);
        approveInternal(wallet, token, to, allowance);
        callContractInternal(wallet, to, 0, data);
    }

    function cancelPendingTx(
        address wallet,
        bytes32 pendingTxId
        )
        external
        nonReentrant
        onlyFromMetaTxOrWalletOwner(wallet)
        onlyWhenWalletUnlocked(wallet)
    {
        require(pendingTransactions[wallet][pendingTxId] != 0, "NOT_FOUND");
        pendingTransactions[wallet][pendingTxId] = 0;
        emit PendingTxCancelled(wallet, pendingTxId);
    }

    function authorizeWalletOwnerAndPendingTx(
        address wallet,
        bytes32 pendingTxId
        )
        private
        returns (bool foundPendingTx)
    {
        if (msg.sender != Wallet(wallet).owner()) {
            if (isPendingTxValidInternal(wallet, pendingTxId)) {
                foundPendingTx = true;
                emit PendingTxExecuted(wallet, pendingTxId, now);
            } else {
                revert("UNAUTHORIZED");
            }
        }
    }

    function isPendingTxValidInternal(
        address wallet,
        bytes32 pendingTxId
        )
        private
        view
        returns (bool)
    {
        uint timestamp = pendingTransactions[wallet][pendingTxId];
        return timestamp > 0 && now <= timestamp + pendingExpiry;
    }

    function getTokenValue(address token, uint amount)
        private
        returns (uint value)
    {
        if (amount == 0) return 0;
        value = controller.priceCacheStore().tokenPrice(token, amount);
        if (value == 0) {
            value = controller.priceOracle().tokenPrice(token, amount);
            if (value > 0) {
                controller.priceCacheStore().cacheTokenPrice(token, amount, value);
            }
        }
    }

    function extractMetaTxSigners(
        address wallet,
        bytes4  method,
        bytes   memory  /* data */
        )
        internal
        view
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
}
