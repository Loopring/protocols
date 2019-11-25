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

import "../../iface/PriceOracle.sol";
import "../../iface/Wallet.sol";

import "../stores/PriceCacheStore.sol";
import "../stores/QuotaStore.sol";
import "../stores/WhitelistStore.sol";

import "./TransferModule.sol";


/// @title QuotaTransfers
contract QuotaTransfers is TransferModule
{
    PriceOracle     public priceOracle;
    PriceCacheStore public priceCacheStore;
    QuotaStore      public quotaStore;
    WhitelistStore  public whitelistStore;

    uint public pendingExpiry;

    mapping (address => mapping(bytes32 => uint)) pendingTransactions;

    event PendingTxCreated (address indexed wallet, bytes32 indexed txid, uint timestamp);
    event PendingTxExecuted(address indexed wallet, bytes32 indexed txid, uint timestamp);

    constructor(
        PriceOracle     _priceOracle,
        PriceCacheStore _priceCacheStore,
        SecurityStore   _securityStore,
        QuotaStore      _quotaStore,
        WhitelistStore  _whitelistStore,
        uint _pendingExpiry
        )
        public
        TransferModule(_securityStore)
    {
        priceOracle = _priceOracle;
        priceCacheStore = _priceCacheStore;
        quotaStore = _quotaStore;
        whitelistStore = _whitelistStore;
        pendingExpiry = _pendingExpiry;
    }

    function staticMethods()
        public
        pure
        returns (bytes4[] memory methods)
    {
        methods = new bytes4[](1);
        methods[0] = this.isPendingTxValid.selector;
    }

    function transferToken(
        address            wallet,
        address            token,
        address            to,
        uint               amount,
        bytes     calldata data,
        bool               enablePending
        )
        external
        nonReentrant
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
                keccak256(data)
            )
        );

        bool foundPendingTx = authorizeWalletOwnerAndPendingTx(wallet, txid);
        bool allowed = whitelistStore.isWhitelisted(wallet, to);
        if (!allowed) {
            uint tokenValue = getTokenValue(token, amount);
            allowed = quotaStore.checkAndAddToSpent(wallet, tokenValue);
        }

        if (allowed) {
            transferInternal(wallet, token, to, amount, data);
            if (foundPendingTx) {
                delete pendingTransactions[wallet][txid];
            }
        } else if(!foundPendingTx && enablePending) {
            createPendingTx(wallet, txid);
            pendingTxId = txid;
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
        onlyFromWalletOwner(wallet)
        onlyWhenWalletUnlocked(wallet)
    {
        if (whitelistStore.isWhitelisted(wallet, to)) {
            approveInternal(wallet, token, to, amount);
            return;
        }

        uint allowance = ERC20(token).allowance(wallet, to);
        if (allowance >= amount) {
            approveInternal(wallet, token, to, amount);
            return;
        }

        allowance = amount - allowance;
        uint tokenValue = getTokenValue(token, allowance);

        if (quotaStore.checkAndAddToSpent(wallet, tokenValue)) {
            approveInternal(wallet, token, to, allowance);
            return;
        }

        revert("OUT_OF_QUOTA");
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
        bool allowed = whitelistStore.isWhitelisted(wallet, to);
        if (!allowed) {
            uint tokenValue = getTokenValue(address(0), amount);
            allowed = quotaStore.checkAndAddToSpent(wallet, tokenValue);
        }

        if (allowed) {
            callContractInternal(wallet, to, amount, data);
            if (foundPendingTx) {
                delete pendingTransactions[wallet][txid];
            }
        } else if(!foundPendingTx && enablePending) {
            createPendingTx(wallet, txid);
            pendingTxId = txid;
        }
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
        onlyFromWalletOwner(wallet)
        onlyWhenWalletUnlocked(wallet)
        notWalletOrItsModule(wallet, to)
    {
        if (whitelistStore.isWhitelisted(wallet, to)) {
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

        allowance -= amount;
        uint tokenValue = getTokenValue(token, allowance);

        if (quotaStore.checkAndAddToSpent(wallet, tokenValue)) {
            approveInternal(wallet, token, to, allowance);
            callContractInternal(wallet, to, 0, data);
            return;
        }

        revert("OUT_OF_QUOTA");
    }

    function authorizeWalletOwnerAndPendingTx(
        address wallet,
        bytes32 pendingTxId
        )
        private
        returns (bool foundPendingTx)
    {
        if (msg.sender != Wallet(wallet).owner()) {
            if (isPendingTxValid(wallet, pendingTxId)) {
                foundPendingTx = true;
                emit PendingTxExecuted(wallet, pendingTxId, now);
            } else {
                revert("UNAUTHORIZED");
            }
        }
    }

    function isPendingTxValid(
        address wallet,
        bytes32 pendingTxId
        )
        public
        view
        returns (bool)
    {
        uint timestamp = pendingTransactions[wallet][pendingTxId];
        return timestamp > 0 && now <= timestamp + pendingExpiry;
    }

    function createPendingTx(
        address wallet,
        bytes32 pendingTxId
        )
        private
    {
        pendingTransactions[wallet][pendingTxId] = now;
        emit PendingTxCreated(wallet, pendingTxId, now);
    }

    function getTokenValue(address token, uint amount)
        private
        returns (uint value)
    {
        if (amount == 0) return 0;
        value = priceCacheStore.tokenPrice(token, amount);
        if (value == 0) {
            value = priceOracle.tokenPrice(token, amount);
            if (value > 0) {
                priceCacheStore.cacheTokenPrice(token, amount, value);
            }
        }
    }

    function extractMetaTxSigners(
        address       /* wallet */,
        bytes4        /* method */,
        bytes memory  /* data */
        )
        internal
        view
        returns (address[] memory)
    {
        revert("UNSUPPORTED");
    }
}
