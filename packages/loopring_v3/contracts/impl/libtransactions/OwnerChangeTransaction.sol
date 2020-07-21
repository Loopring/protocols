// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.6.10;
pragma experimental ABIEncoderV2;

import "../../iface/ExchangeData.sol";
import "../../thirdparty/BytesUtil.sol";
import "../../lib/EIP712.sol";
import "../../lib/FloatUtil.sol";
import "../../lib/SignatureUtil.sol";


/// @title OwnerChangeTransaction
/// @author Brecht Devos - <brecht@loopring.org>
/// @dev There are a few concepts we need to clarify:
///   - statelessWallet: it's a stateless contract that can be used to verify permissions for layer-2
///                      wallet recovery, inheritance, etc. We do not have to define an interface, as
///                      the protocol will call a StatelessWallet's static functions based on data provided
///                      by the old/new owners.
///   - walletDataHash:  a hash of the wallet's data. Neither the data itself or this walletDataHash will
///                      be stored in the Merkle tree. We suppose the wallet data and this hash are both managed
///                      on the client side. The definition of wallet's data and the way it is hashed are also
///                      controlled by the associated StatelessWallet.
///   - walletHash:      a hash calculated from both the walletDataHash and the address of the wallet's
///                      associated StatelessWallet. walletHash is the only wallet-related data stored in
///                      the Merkel tree.
///   - walletCalldata:  the calldata for invoking the wallet's associated StatelessWallet.
///
library OwnerChangeTransaction
{
    using BytesUtil            for bytes;
    using FloatUtil            for uint;
    using SignatureUtil        for bytes32;

    // bytes4(keccak256("transferOwnership(bytes,bytes)")
    bytes4  constant public RECOVERY_MAGICVALUE = 0xd1f21f4f;

    bytes32 constant public ACCOUNTTRANSFER_TYPEHASH = keccak256(
        "OwnerChange(address owner,uint24 accountID,uint16 feeTokenID,uint256 fee,address newOwner,uint32 nonce,address statelessWallet,bytes32 walletDataHash,bytes walletCalldata)"
    );

    bytes32 constant public WALLET_TYPEHASH = keccak256(
        "Wallet(address statelessWallet,bytes32 walletDataHash)"
    );

    /*event AccountTransfered(
        address owner,
        address newOwner
    );*/

    struct AccountTransfer
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
    struct AccountTransferAuxiliaryData
    {
        bytes   signatureOldOwner;
        bytes   signatureNewOwner;
        address statelessWallet;
        bytes32 walletDataHash;
        bytes   walletCalldata;
    }

    function process(
        ExchangeData.State        storage S,
        ExchangeData.BlockContext memory  ctx,
        bytes                     memory  data,
        bytes                     memory  auxiliaryData
        )
        internal
        returns (uint /*feeETH*/)
    {
        AccountTransfer memory accountTransfer = readAccountTransfer(data);

        AccountTransferAuxiliaryData memory auxData = abi.decode(
            auxiliaryData,
            (AccountTransferAuxiliaryData)
        );

        // Calculate the tx hash
        bytes32 txHash = EIP712.hashPacked(
            ctx.DOMAIN_SEPARATOR,
            keccak256(
                abi.encode(
                    ACCOUNTTRANSFER_TYPEHASH,
                    accountTransfer.owner,
                    accountTransfer.accountID,
                    accountTransfer.feeTokenID,
                    accountTransfer.fee,
                    accountTransfer.newOwner,
                    accountTransfer.nonce,
                    auxData.statelessWallet,
                    auxData.walletDataHash,
                    keccak256(auxData.walletCalldata)
                )
            )
        );

        // Verify authorization from the new owner
        if (auxData.signatureNewOwner.length > 0) {
            require(
                txHash.verifySignature(
                    accountTransfer.newOwner,
                    auxData.signatureNewOwner
                ),
                "INVALID_SIGNATURE_NEW_OWNER"
            );
        } else {
            require(
                S.approvedTx[accountTransfer.newOwner][txHash],
                "TX_NOT_APPROVED_NEW_OWNER"
            );
            delete S.approvedTx[accountTransfer.newOwner][txHash];
        }

        if (auxData.statelessWallet == address(0)) {
            /// Verify authorization from the current owner
            if (auxData.signatureOldOwner.length > 0) {
                require(
                    txHash.verifySignature(
                        accountTransfer.owner,
                        auxData.signatureOldOwner
                    ),
                    "INVALID_SIGNATURE_OLD_OWNER"
                );
            } else {
                require(
                    S.approvedTx[accountTransfer.owner][txHash],
                    "TX_NOT_APPROVED_OLD_OWNER"
                );
                delete S.approvedTx[accountTransfer.owner][txHash];
            }
        } else {
            // If the account has a wallet, use it to recover the account
            require(accountTransfer.walletHash != 0, "ACCOUNT_HAS_NO_WALLET");

            // Calculate the wallet hash
            bytes32 walletHash = EIP712.hashPacked(
                S.DOMAIN_SEPARATOR,
                keccak256(
                    abi.encode(
                        WALLET_TYPEHASH,
                        auxData.statelessWallet,
                        auxData.walletDataHash
                    )
                )
            );
            // Hashes are stored using only 253 bits so the value fits inside a SNARK field element.
            require(
                (uint(walletHash) >> 3) == uint(accountTransfer.walletHash),
                "INVALID_WALLET_HASH"
            );

            // Check that the calldata contains the correct inputs for data coming from layer 2.
            // This data is also padded with zeros to 32 bytes (at the MSB) inside the calldata.
            // parameter 0: accountID
            // parameter 1: nonce
            // parameter 2: oldOwner
            // parameter 3: newOwner
            // parameter 4: walletDataHash
            uint offset = 4;
            require(
                auxData.walletCalldata.toUint24(29 + offset) == accountTransfer.accountID,
                "INVALID_WALLET_CALLDATA"
            );
            offset += 32;

            require(
                auxData.walletCalldata.toUint32(28 + offset) == accountTransfer.nonce,
                "INVALID_WALLET_CALLDATA"
            );
            offset += 32;

            require(
                auxData.walletCalldata.toAddress(12 + offset) == accountTransfer.owner,
                "INVALID_WALLET_CALLDATA"
            );
            offset += 32;

            require(
                auxData.walletCalldata.toAddress(12 + offset) == accountTransfer.newOwner,
                "INVALID_WALLET_CALLDATA"
            );
            offset += 32;

            require(
                auxData.walletCalldata.toBytes32(offset) == auxData.walletDataHash,
                "INVALID_WALLET_CALLDATA"
            );
            offset += 32;

            (bool success, bytes memory result) =
                auxData.statelessWallet.staticcall(auxData.walletCalldata);

            require(
                success &&
                result.length == 32 &&
                result.toBytes4(0) == RECOVERY_MAGICVALUE,
                "WALLET_RECOVERY_FAILED"
            );
        }

        //emit AccountTransfered(accountTransfer.owner, accountTransfer.newOwner);
    }

    function readAccountTransfer(
        bytes memory data
        )
        internal
        pure
        returns (AccountTransfer memory)
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

        return AccountTransfer({
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
