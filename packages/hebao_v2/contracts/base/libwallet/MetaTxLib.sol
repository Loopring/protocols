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
        "MetaTx(address relayer,address to,uint256 validUntil,address gasToken,uint256 gasPrice,uint256 gasLimit,uint256 gasOverhead,bytes data)"
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
        uint    validUntil;
        address gasToken;
        uint    gasPrice;
        uint    gasLimit;
        uint    gasOverhead;
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
            msg.sender,
            metaTx.to,
            metaTx.validUntil,
            metaTx.gasToken,
            metaTx.gasPrice,
            metaTx.gasLimit,
            metaTx.gasOverhead,
            metaTx.requiresSuccess,
            keccak256(metaTx.data)
        );
        bytes32 metaTxHash = EIP712.hashPacked(DOMAIN_SEPARATOR, encoded);
        require(metaTxHash.verifySignature(wallet.owner, metaTx.signature), "INVALID_SIGNATURE");

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
        require(metaTx.validUntil >= block.timestamp, "METATX_EXPIRED");

        uint gasLeft = gasleft();
        require(gasLeft >= (metaTx.gasLimit.mul(64) / 63), "OPERATOR_INSUFFICIENT_GAS");

        (success, ) = metaTx.to.call{gas : metaTx.gasLimit}(metaTx.data);

        // These checks are done afterwards to use the latest state post meta-tx call
        require(!wallet.locked, "WALLET_LOCKED");

        bytes32 metaTxHash = validateMetaTx(
            wallet,
            DOMAIN_SEPARATOR,
            metaTx
        );
        require(!wallet.metaTxHashes[metaTxHash], "METATX_HASH_EXIST");
        wallet.metaTxHashes[metaTxHash] = true;

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

            ERC20Lib.transfer(metaTx.gasToken, msg.sender, gasCost);
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

}
