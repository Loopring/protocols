// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.6.10;
pragma experimental ABIEncoderV2;

import "../../iface/ExchangeData.sol";
import "../../thirdparty/BytesUtil.sol";
import "../../lib/EIP712.sol";
import "../../lib/FloatUtil.sol";
import "../../lib/MathUint.sol";
import "../../lib/SignatureUtil.sol";


/// @title OwnerChangeTransaction
/// @author Brecht Devos - <brecht@loopring.org>
library OwnerChangeTransaction
{
    using BytesUtil            for bytes;
    using FloatUtil            for uint;
    using MathUint             for uint;
    using SignatureUtil        for bytes32;

    // bytes4(keccak256("transferOwnership(bytes,bytes)")
    bytes4 constant internal MAGICVALUE = 0xd1f21f4f;

    bytes32 constant public OWNERCHANGE_TYPEHASH = keccak256(
        "OwnerChange(address owner,uint24 accountID,uint16 feeTokenID,uint256 fee,address newOwner,uint32 nonce,address walletAddress,bytes32 walletDataHash,bytes walletCalldata)"
    );

    bytes32 constant public WALLET_TYPEHASH = keccak256(
        "Wallet(address walletAddress,bytes32 walletDataHash)"
    );

    /*event ChangeOwnerConsumed(
        address  indexed owner,
        address          newOwner
    );*/

    struct OwnerChange
    {
        address owner;
        uint24  accountID;
        uint16  feeTokenID;
        uint    fee;
        address newOwner;
        uint32  nonce;
        bytes32 walletHash;
    }

    // Auxiliary data for each owner change
    struct OwnerChangeAuxiliaryData
    {
        bytes   signatureOldOwner;
        bytes   signatureNewOwner;

        address walletAddress;
        bytes32 walletDataHash;
        bytes   walletCalldata;
    }

    function process(
        ExchangeData.State storage S,
        ExchangeData.BlockContext memory ctx,
        bytes memory data,
        bytes memory auxiliaryData
        )
        internal
        returns (uint /*feeETH*/)
    {
        OwnerChange memory ownerChange = readOwnerChange(data);

        OwnerChangeAuxiliaryData memory auxData = abi.decode(auxiliaryData, (OwnerChangeAuxiliaryData));

        // Calculate the tx hash
        bytes32 txHash = EIP712.hashPacked(
            ctx.DOMAIN_SEPARATOR,
            keccak256(
                abi.encode(
                    OWNERCHANGE_TYPEHASH,
                    ownerChange.owner,
                    ownerChange.accountID,
                    ownerChange.feeTokenID,
                    ownerChange.fee,
                    ownerChange.newOwner,
                    ownerChange.nonce,
                    auxData.walletAddress,
                    auxData.walletDataHash,
                    keccak256(auxData.walletCalldata)
                )
            )
        );

        // Verify the signature if one is provided, otherwise fall back to an approved tx
        if (auxData.signatureNewOwner.length > 0) {
            require(txHash.verifySignature(ownerChange.newOwner, auxData.signatureNewOwner), "INVALID_SIGNATURE");
        } else {
            require(S.approvedTx[ownerChange.newOwner][txHash], "TX_NOT_APPROVED");
            S.approvedTx[ownerChange.newOwner][txHash] = false;
        }

        if (auxData.walletAddress == address(0)) {
            // We allow the owner of the account to change when authorized by the current owner.
            // Verify the signature if one is provided, otherwise fall back to an approved tx
            if (auxData.signatureOldOwner.length > 0) {
                require(txHash.verifySignature(ownerChange.owner, auxData.signatureOldOwner), "INVALID_SIGNATURE");
            } else {
                require(S.approvedTx[ownerChange.owner][txHash], "TX_NOT_APPROVED");
                S.approvedTx[ownerChange.owner][txHash] = false;
            }
        } else {
            // If the account has a wallet, use it to recover the account
            require(ownerChange.walletHash != 0, "ACCOUNT_HAS_NO_WALLET");

            // Calculate the wallet hash
            bytes32 walletHash = EIP712.hashPacked(
                S.DOMAIN_SEPARATOR,
                keccak256(
                    abi.encode(
                        WALLET_TYPEHASH,
                        auxData.walletAddress,
                        auxData.walletDataHash
                    )
                )
            );
            // Hashes are stored using only 253 bits so the value fits inside a SNARK field element.
            require((uint(walletHash) >> 3) == uint(ownerChange.walletHash), "INVALID_WALLET_HASH");

            // Check that the calldata contains the correct inputs for data coming from layer 2.
            // This data is also padded with zeros to 32 bytes (at the MSB) inside the calldata.
            // parameter 0: accountID
            // parameter 1: nonce
            // parameter 2: oldOwner
            // parameter 3: newOwner
            // parameter 4: walletDataHash
            uint offset = 4;
            require(auxData.walletCalldata.toUint24(29 + offset) == ownerChange.accountID, "INVALID_WALLET_CALLDATA");
            offset += 32;
            require(auxData.walletCalldata.toUint32(28 + offset) == ownerChange.nonce, "INVALID_WALLET_CALLDATA");
            offset += 32;
            require(auxData.walletCalldata.toAddress(12 + offset) == ownerChange.owner, "INVALID_WALLET_CALLDATA");
            offset += 32;
            require(auxData.walletCalldata.toAddress(12 + offset) == ownerChange.newOwner, "INVALID_WALLET_CALLDATA");
            offset += 32;
            require(auxData.walletCalldata.toBytes32(offset) == auxData.walletDataHash, "INVALID_WALLET_CALLDATA");
            offset += 32;
            (bool success, bytes memory result) = auxData.walletAddress.staticcall(auxData.walletCalldata);
            bool validated = success && result.length == 32 && result.toBytes4(0) == MAGICVALUE;
            require(validated, "WALLET_CALL_FAILED");
        }

        //emit ChangeOwnerConsumed(ownerChange.owner, ownerChange.newOwner);
    }

    function readOwnerChange(
        bytes memory data
        )
        internal
        pure
        returns (OwnerChange memory)
    {
        uint offset = 1;

        // Extract the transfer data
        address owner = data.toAddress(offset);
        offset += 20;
        uint24 accountID = data.toUint24(offset);
        offset += 3;
        uint32 nonce = data.toUint32(offset);
        offset += 4;
        uint16 feeTokenID = data.toUint16(offset);
        offset += 2;
        uint fee = uint(data.toUint16(offset)).decodeFloat(16);
        offset += 2;
        address newOwner = data.toAddress(offset);
        offset += 20;
        bytes32 walletHash = data.toBytes32(offset);
        offset += 32;

        return OwnerChange({
            owner: owner,
            accountID: accountID,
            nonce: nonce,
            feeTokenID: feeTokenID,
            fee: fee,
            newOwner: newOwner,
            walletHash: walletHash
        });
    }
}
