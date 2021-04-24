// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../../lib/EIP712.sol";
import "../../../lib/FloatUtil.sol";
import "../../../lib/MathUint.sol";
import "../../../lib/SignatureUtil.sol";
import "../../../thirdparty/BytesUtil.sol";
import "../../iface/ExchangeData.sol";
import "../libexchange/ExchangeMode.sol";
import "../libexchange/ExchangeSignatures.sol";
import "../libexchange/ExchangeWithdrawals.sol";


/// @title WithdrawTransaction
/// @author Brecht Devos - <brecht@loopring.org>
/// @dev The following 4 types of withdrawals are supported:
///      - withdrawType = 0: offchain withdrawals with EdDSA signatures
///      - withdrawType = 1: offchain withdrawals with ECDSA signatures or onchain appprovals
///      - withdrawType = 2: onchain valid forced withdrawals (owner and accountID match), or
///                          offchain operator-initiated withdrawals for protocol fees or for
///                          users in shutdown mode
///      - withdrawType = 3: onchain invalid forced withdrawals (owner and accountID mismatch)
library WithdrawTransaction
{
    using BytesUtil            for bytes;
    using FloatUtil            for uint16;
    using MathUint             for uint;
    using ExchangeMode         for ExchangeData.State;
    using ExchangeSignatures   for ExchangeData.State;
    using ExchangeWithdrawals  for ExchangeData.State;

    bytes32 constant public WITHDRAWAL_TYPEHASH = keccak256(
        "Withdrawal(address owner,uint32 accountID,uint16 tokenID,uint96 amount,uint16 feeTokenID,uint96 maxFee,address to,bytes extraData,uint256 minGas,uint32 validUntil,uint32 storageID)"
    );

    struct Withdrawal
    {
        uint    withdrawalType;
        address from;
        uint32  fromAccountID;
        uint16  tokenID;
        uint96  amount;
        uint16  feeTokenID;
        uint96  maxFee;
        uint96  fee;
        address to;
        bytes   extraData;
        uint    minGas;
        uint32  validUntil;
        uint32  storageID;
        bytes20 onchainDataHash;
    }

    // Auxiliary data for each withdrawal
    struct WithdrawalAuxiliaryData
    {
        bool  storeRecipient;
        uint  gasLimit;
        bytes signature;

        uint    minGas;
        address to;
        bytes   extraData;
        uint96  maxFee;
        uint32  validUntil;
    }

    function process(
        ExchangeData.State        storage S,
        ExchangeData.BlockContext memory  ctx,
        bytes                     memory  data,
        uint                              offset,
        bytes                     memory  auxiliaryData,
        bool                              approved
        )
        internal
    {
        Withdrawal memory withdrawal;
        readTx(data, offset, withdrawal);
        WithdrawalAuxiliaryData memory auxData = abi.decode(auxiliaryData, (WithdrawalAuxiliaryData));

        // Validate the withdrawal data not directly part of the DA
        bytes20 onchainDataHash = hashOnchainData(
            auxData.minGas,
            auxData.to,
            auxData.extraData
        );
        // Only the 20 MSB are used, which is still 80-bit of security, which is more
        // than enough, especially when combined with validUntil.
        require(withdrawal.onchainDataHash == onchainDataHash, "INVALID_WITHDRAWAL_DATA");

        // Fill in withdrawal data missing from DA
        withdrawal.to = auxData.to;
        withdrawal.minGas = auxData.minGas;
        withdrawal.extraData = auxData.extraData;
        withdrawal.maxFee = auxData.maxFee == 0 ? withdrawal.fee : auxData.maxFee;
        withdrawal.validUntil = auxData.validUntil;

        // If the account has an owner, don't allow withdrawing to the zero address
        // (which will be the protocol fee vault contract).
        require(withdrawal.from == address(0) || withdrawal.to != address(0), "INVALID_WITHDRAWAL_RECIPIENT");

        if (withdrawal.withdrawalType == 0) {
            // Signature checked offchain, nothing to do
        } else if (withdrawal.withdrawalType == 1) {
            // Validate
            require(ctx.timestamp < withdrawal.validUntil, "WITHDRAWAL_EXPIRED");
            require(withdrawal.fee <= withdrawal.maxFee, "WITHDRAWAL_FEE_TOO_HIGH");

            if (!approved) {
                // Check appproval onchain
                // Calculate the tx hash
                bytes32 txHash = hashTx(ctx.DOMAIN_SEPARATOR, withdrawal);
                // Check onchain authorization
                S.requireAuthorizedTx(withdrawal.from, auxData.signature, txHash);
            }
        } else if (withdrawal.withdrawalType == 2 || withdrawal.withdrawalType == 3) {
            // Forced withdrawals cannot make use of certain features because the
            // necessary data is not authorized by the account owner.
            // For protocol fee withdrawals, `owner` and `to` are both address(0).
            require(withdrawal.from == withdrawal.to, "INVALID_WITHDRAWAL_ADDRESS");

            // Forced withdrawal fees are charged when the request is submitted.
            require(withdrawal.fee == 0, "FEE_NOT_ZERO");

            require(withdrawal.extraData.length == 0, "AUXILIARY_DATA_NOT_ALLOWED");

            ExchangeData.ForcedWithdrawal memory forcedWithdrawal =
                S.pendingForcedWithdrawals[withdrawal.fromAccountID][withdrawal.tokenID];

            if (forcedWithdrawal.timestamp != 0) {
                if (withdrawal.withdrawalType == 2) {
                    require(withdrawal.from == forcedWithdrawal.owner, "INCONSISENT_OWNER");
                } else { //withdrawal.withdrawalType == 3
                    require(withdrawal.from != forcedWithdrawal.owner, "INCONSISENT_OWNER");
                    require(withdrawal.amount == 0, "UNAUTHORIZED_WITHDRAWAL");
                }

                // delete the withdrawal request and free a slot
                delete S.pendingForcedWithdrawals[withdrawal.fromAccountID][withdrawal.tokenID];
                S.numPendingForcedTransactions--;
            } else {
                // Allow the owner to submit full withdrawals without authorization
                // - when in shutdown mode
                // - to withdraw protocol fees
                require(
                    withdrawal.fromAccountID == ExchangeData.ACCOUNTID_PROTOCOLFEE ||
                    S.isShutdown(),
                    "FULL_WITHDRAWAL_UNAUTHORIZED"
                );
            }
        } else {
            revert("INVALID_WITHDRAWAL_TYPE");
        }

        // Check if there is a withdrawal recipient
        address recipient = S.withdrawalRecipient[withdrawal.from][withdrawal.to][withdrawal.tokenID][withdrawal.amount][withdrawal.storageID];
        if (recipient != address(0)) {
            // Auxiliary data is not supported
            require (withdrawal.extraData.length == 0, "AUXILIARY_DATA_NOT_ALLOWED");

            // Set the new recipient address
            withdrawal.to = recipient;
            // Allow any amount of gas to be used on this withdrawal (which allows the transfer to be skipped)
            withdrawal.minGas = 0;

            // Do NOT delete the recipient to prevent replay attack
            // delete S.withdrawalRecipient[withdrawal.owner][withdrawal.to][withdrawal.tokenID][withdrawal.amount][withdrawal.storageID];
        } else if (auxData.storeRecipient) {
            // Store the destination address to mark the withdrawal as done
            require(withdrawal.to != address(0), "INVALID_DESTINATION_ADDRESS");
            S.withdrawalRecipient[withdrawal.from][withdrawal.to][withdrawal.tokenID][withdrawal.amount][withdrawal.storageID] = withdrawal.to;
        }

        // Validate gas provided
        require(auxData.gasLimit >= withdrawal.minGas, "OUT_OF_GAS_FOR_WITHDRAWAL");

        // Try to transfer the tokens with the provided gas limit
        S.distributeWithdrawal(
            withdrawal.from,
            withdrawal.to,
            withdrawal.tokenID,
            withdrawal.amount,
            withdrawal.extraData,
            auxData.gasLimit
        );
    }

    function readTx(
        bytes      memory data,
        uint              offset,
        Withdrawal memory withdrawal
        )
        internal
        pure
    {
        uint _offset = offset;

        require(data.toUint8Unsafe(_offset) == uint8(ExchangeData.TransactionType.WITHDRAWAL), "INVALID_TX_TYPE");
        _offset += 1;

        // Extract the transfer data
        // We don't use abi.decode for this because of the large amount of zero-padding
        // bytes the circuit would also have to hash.
        withdrawal.withdrawalType = data.toUint8Unsafe(_offset);
        _offset += 1;
        withdrawal.from = data.toAddressUnsafe(_offset);
        _offset += 20;
        withdrawal.fromAccountID = data.toUint32Unsafe(_offset);
        _offset += 4;
        withdrawal.tokenID = data.toUint16Unsafe(_offset);
        _offset += 2;
        withdrawal.amount = data.toUint96Unsafe(_offset);
        _offset += 12;
        withdrawal.feeTokenID = data.toUint16Unsafe(_offset);
        _offset += 2;
        withdrawal.fee = data.toUint16Unsafe(_offset).decodeFloat16();
        _offset += 2;
        withdrawal.storageID = data.toUint32Unsafe(_offset);
        _offset += 4;
        withdrawal.onchainDataHash = data.toBytes20Unsafe(_offset);
        _offset += 20;
    }

    function hashTx(
        bytes32 DOMAIN_SEPARATOR,
        Withdrawal memory withdrawal
        )
        internal
        pure
        returns (bytes32)
    {
        return EIP712.hashPacked(
            DOMAIN_SEPARATOR,
            keccak256(
                abi.encode(
                    WITHDRAWAL_TYPEHASH,
                    withdrawal.from,
                    withdrawal.fromAccountID,
                    withdrawal.tokenID,
                    withdrawal.amount,
                    withdrawal.feeTokenID,
                    withdrawal.maxFee,
                    withdrawal.to,
                    keccak256(withdrawal.extraData),
                    withdrawal.minGas,
                    withdrawal.validUntil,
                    withdrawal.storageID
                )
            )
        );
    }

    function hashOnchainData(
        uint    minGas,
        address to,
        bytes   memory extraData
        )
        internal
        pure
        returns (bytes20)
    {
        // Only the 20 MSB are used, which is still 80-bit of security, which is more
        // than enough, especially when combined with validUntil.
        return bytes20(keccak256(
            abi.encodePacked(
                minGas,
                to,
                extraData
            )
        ));
    }
}
