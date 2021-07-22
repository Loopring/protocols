// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../lib/AddressUtil.sol";
import "../../lib/EIP712.sol";
import "../../lib/ERC20.sol";
import "../../lib/MathUint.sol";
import "../../lib/SignatureUtil.sol";
import "../../thirdparty/BytesUtil.sol";
import "./WalletData.sol";
import "./ERC20Lib.sol";
import "./QuotaLib.sol";
import "../SmartWallet.sol";


/// @title MetaTxLib
/// @dev A module to support wallet meta-transactions.
library MetaTxLib
{
    using AddressUtil   for address;
    using BytesUtil     for bytes;
    using MathUint      for uint;
    using SignatureUtil for bytes32;
    using QuotaLib      for Wallet;
    using ERC20Lib      for Wallet;

    bytes32 public constant META_TX_TYPEHASH = keccak256(
        "MetaTx(address to,uint256 nonce,address gasToken,uint256 gasPrice,uint256 gasLimit,uint256 gasOverhead,address feeReceipt,bytes data)"
    );

    event MetaTxExecuted(
        address relayer,
        bytes32 metaTxHash,
        bool    success,
        uint    gasUsed
    );

    struct MetaTx
    {
        address to;
        uint    nonce;
        address gasToken;
        uint    gasPrice;
        uint    gasLimit;
        uint    gasOverhead;
        address feeReceipt;
        bool    requiresSuccess;
        bytes   data;
        bytes   signature;
    }

    function validateMetaTx(
        Wallet  storage wallet,
        bytes32 DOMAIN_SEPARATOR,
        MetaTx  memory  metaTx
        )
        public
        view
        returns (bytes32)
    {
        bytes memory encoded = abi.encode(
            META_TX_TYPEHASH,
            metaTx.to,
            metaTx.nonce,
            metaTx.gasToken,
            metaTx.gasPrice,
            metaTx.gasLimit,
            metaTx.gasOverhead,
            metaTx.feeReceipt,
            metaTx.requiresSuccess,
            keccak256(metaTx.data)
        );
        bytes32 metaTxHash = EIP712.hashPacked(DOMAIN_SEPARATOR, encoded);

        // metaTxHash.nonce == 0 means a *-WA function is called.
        // No need to verify metaTx signature when calling a *-WA function.
        if (metaTx.nonce != 0) {
            require(metaTxHash.verifySignature(wallet.owner, metaTx.signature), "METATX_INVALID_SIGNATURE");
        }
        return metaTxHash;
    }

    function executeMetaTx(
        Wallet      storage wallet,
        bytes32             DOMAIN_SEPARATOR,
        PriceOracle         priceOracle,
        MetaTx      memory  metaTx
        )
        public
        returns (bool success)
    {
        require(msg.sender != address(this), "RECURSIVE_METATXS_DISALLOWED");

        require(metaTx.to == address(this));

        uint gasLeft = gasleft();
        require(gasLeft >= (metaTx.gasLimit.mul(64) / 63), "OPERATOR_INSUFFICIENT_GAS");

        // Update the nonce before the call to protect against reentrancy
        require(isNonceValid(wallet, metaTx.nonce, metaTx.data.toBytes4(0)), "INVALID_NONCE");
        if (metaTx.nonce != 0) {
            wallet.nonce = metaTx.nonce;
        } else {
            require(metaTx.requiresSuccess, "META_TX_WITHOUT_NONCE_REQUIRES_SUCCESS");
        }

        (success, ) = metaTx.to.call{gas: metaTx.gasLimit}(metaTx.data);

        // These checks are done afterwards to use the latest state post meta-tx call
        require(!wallet.locked, "WALLET_LOCKED");

        bytes32 metaTxHash = validateMetaTx(
            wallet,
            DOMAIN_SEPARATOR,
            metaTx
        );

        uint gasUsed = gasLeft - gasleft() + metaTx.gasOverhead;

        // Reimburse
        if (metaTx.gasPrice > 0 && (!metaTx.requiresSuccess || success)) {
            uint gasToReimburse = gasUsed <= metaTx.gasLimit ? gasUsed : metaTx.gasLimit;
            uint gasCost = gasToReimburse.mul(metaTx.gasPrice);

            wallet.checkAndAddToSpent(
                priceOracle,
                metaTx.gasToken,
                gasCost
            );

            ERC20Lib.transfer(metaTx.gasToken, metaTx.feeReceipt, gasCost);
        }

        emit MetaTxExecuted(
            msg.sender,
            metaTxHash,
            success,
            gasUsed
        );
    }

    function batchCall(
        Wallet    storage  /*wallet*/,
        address[] calldata to,
        bytes[]   calldata data
        )
        public
    {
        require(to.length == data.length, "INVALID_DATA");

        for (uint i = 0; i < to.length; i++) {
            require(to[i] == address(this));
            (bool success, ) = to[i].call(data[i]);
            require(success, "BATCHED_CALL_FAILED");
        }
    }

    function isNonceValid(
        Wallet  storage wallet,
        uint    nonce,
        bytes4  methodId
        )
        public
        view
        returns (bool)
    {
        if ( methodId == SmartWallet.changeMasterCopy.selector ||
             methodId == SmartWallet.addGuardianWA.selector ||
             methodId == SmartWallet.removeGuardianWA.selector ||
             methodId == SmartWallet.unlock.selector ||
             methodId == SmartWallet.changeDailyQuotaWA.selector ||
             methodId == SmartWallet.recover.selector ||
             methodId == SmartWallet.addToWhitelistWA.selector ||
             methodId == SmartWallet.transferTokenWA.selector ||
             methodId == SmartWallet.callContractWA.selector ||
             methodId == SmartWallet.approveTokenWA.selector ||
             methodId == SmartWallet.approveThenCallContractWA.selector ) {
            return nonce == 0;
        } else {
            return nonce > wallet.nonce && (nonce >> 128) <= block.number;
        }
    }
}
