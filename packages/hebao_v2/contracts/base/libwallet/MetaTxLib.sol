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
        "MetaTx(address to,uint256 nonce,uint256 validUntil,address gasToken,uint256 gasPrice,uint256 gasLimit,uint256 gasOverhead,address feeRecipient,bytes data,bytes32 approvedHash)"
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
        uint    validUntil;
        address gasToken;
        uint    gasPrice;
        uint    gasLimit;
        uint    gasOverhead;
        address feeRecipient;
        bool    requiresSuccess;
        bytes   data;
        bytes   signature;
    }

    function validateMetaTx(
        Wallet  storage wallet,
        bytes32 DOMAIN_SEPARATOR,
        MetaTx  memory  metaTx,
        bytes   memory  returnData
        )
        public
        view
        returns (bytes32)
    {
        // If this is a dataless meta-tx the user only signs the function selector,
        // not the full function calldata.
        bytes memory data = metaTx.nonce == 0 ? metaTx.data.slice(0, 4) : metaTx.data;
        // Extracted the approved hash for dataless transactions
        bytes32 approvedHash = metaTx.nonce == 0 ? abi.decode(returnData, (bytes32)) : bytes32(0);

        bytes memory encoded = abi.encode(
            META_TX_TYPEHASH,
            metaTx.to,
            metaTx.nonce,
            metaTx.validUntil,
            metaTx.gasToken,
            metaTx.gasPrice,
            metaTx.gasLimit,
            metaTx.gasOverhead,
            metaTx.feeRecipient,
            metaTx.requiresSuccess,
            keccak256(data),
            approvedHash
        );
        bytes32 metaTxHash = EIP712.hashPacked(DOMAIN_SEPARATOR, encoded);
        require(metaTxHash.verifySignature(wallet.owner, metaTx.signature), "METATX_INVALID_SIGNATURE");
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

        // Only self calls allowed for now
        require(metaTx.to == address(this));

        uint gasLeft = gasleft();
        require(gasLeft >= (metaTx.gasLimit.mul(64) / 63), "OPERATOR_INSUFFICIENT_GAS");

        // Update the nonce before the call to protect against reentrancy
        require(isNonceValid(wallet, metaTx), "INVALID_NONCE");
        if (metaTx.nonce != 0) {
            wallet.nonce = metaTx.nonce;
        }

        // Check if the meta-tx is still valid
        require(block.timestamp <= metaTx.validUntil, "METATX_EXPIRED");

        // Do the actual call
        bytes memory returnData;
        (success, returnData) = metaTx.to.call{gas: metaTx.gasLimit}(metaTx.data);

        // These checks are done afterwards to use the latest state post meta-tx call
        require(!wallet.locked, "WALLET_LOCKED");

        bytes32 metaTxHash = validateMetaTx(
            wallet,
            DOMAIN_SEPARATOR,
            metaTx,
            returnData
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

            ERC20Lib.transfer(metaTx.gasToken, metaTx.feeRecipient, gasCost);
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
        MetaTx  memory  metaTx
        )
        public
        view
        returns (bool)
    {
        return (metaTx.nonce > wallet.nonce && (metaTx.nonce >> 128) <= block.number) ||
               isDataless(metaTx);
    }

    function isDataless(
        MetaTx memory metaTx
        )
        public
        pure
        returns (bool)
    {
        // We don't require any data in the meta tx when
        // - the meta-tx has no nonce
        // - the meta-tx needs to be successful
        // - a function is called that requires a majority of guardians and fails when replayed
        bytes4 methodId = metaTx.data.toBytes4(0);
        return metaTx.nonce == 0 &&
               metaTx.requiresSuccess &&
               (methodId == SmartWallet.changeMasterCopy.selector ||
                methodId == SmartWallet.addGuardianWA.selector ||
                methodId == SmartWallet.removeGuardianWA.selector ||
                methodId == SmartWallet.unlock.selector ||
                methodId == SmartWallet.changeDailyQuotaWA.selector ||
                methodId == SmartWallet.recover.selector ||
                methodId == SmartWallet.addToWhitelistWA.selector ||
                methodId == SmartWallet.transferTokenWA.selector ||
                methodId == SmartWallet.callContractWA.selector ||
                methodId == SmartWallet.approveTokenWA.selector ||
                methodId == SmartWallet.approveThenCallContractWA.selector);
    }
}
