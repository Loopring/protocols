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
    using FloatUtil            for uint;
    using MathUint             for uint;
    using ExchangeMode         for ExchangeData.State;
    using ExchangeSignatures   for ExchangeData.State;
    using ExchangeWithdrawals  for ExchangeData.State;

    bytes32 constant public WITHDRAWAL_TYPEHASH = keccak256(
        "Withdrawal(address owner,uint32 accountID,uint16 tokenID,uint256 amount,uint16 feeTokenID,uint256 fee,address to,bytes extraData,uint minGas,uint32 validUntil,uint32 nonce)"
    );

    struct Withdrawal
    {
        uint    withdrawalType;
        address owner;
        uint32  accountID;
        uint16  tokenID;
        uint    amount;
        uint16  feeTokenID;
        uint    fee;
        address to;
        bytes   extraData;
        uint    minGas;
        uint32  validUntil;
        uint32  nonce;
        bytes20 onchainDataHash;
    }

    // Auxiliary data for each withdrawal
    struct WithdrawalAuxiliaryData
    {
        uint  gasLimit;
        bytes signature;

        uint    minGas;
        address to;
        bytes   extraData;
        uint32  validUntil;
    }

    /*event ForcedWithdrawalProcessed(
        uint32 accountID,
        uint16 tokenID,
        uint   amount
    );*/

    function process(
        ExchangeData.State        storage S,
        ExchangeData.BlockContext memory  ctx,
        bytes                     memory  data,
        uint                              offset,
        bytes                     memory  auxiliaryData
        )
        internal
        returns (uint feeETH)
    {
        Withdrawal memory withdrawal = readTx(data, offset);
        WithdrawalAuxiliaryData memory auxData = abi.decode(auxiliaryData, (WithdrawalAuxiliaryData));

        // Validate the withdrawal data not directly part of the DA
        bytes32 onchainDataHash = keccak256(
            abi.encodePacked(
                auxData.minGas,
                auxData.to,
                auxData.extraData
            )
        );
        // Only the 20 MSB are used, which is still 80-bit of security, which is more
        // than enough, especially when combined with validUntil.
        require(withdrawal.onchainDataHash == bytes20(onchainDataHash), "INVALID_WITHDRAWAL_DATA");

        // Fill in withdrawal data missing from DA
        withdrawal.to = auxData.to;
        withdrawal.minGas = auxData.minGas;
        withdrawal.extraData = auxData.extraData;
        withdrawal.validUntil = auxData.validUntil;

        if (withdrawal.withdrawalType == 0) {
            // Signature checked offchain, nothing to do
        } else if (withdrawal.withdrawalType == 1) {
            // Check validUntil
            require(ctx.timestamp < withdrawal.validUntil, "WITHDRAWAL_EXPIRED");
            // Check appproval onchain
            // Calculate the tx hash
            bytes32 txHash = hashTx(ctx.DOMAIN_SEPARATOR, withdrawal);
            // Check onchain authorization
            S.requireAuthorizedTx(withdrawal.owner, auxData.signature, txHash);
        } else if (withdrawal.withdrawalType == 2 || withdrawal.withdrawalType == 3) {
            // Forced withdrawals cannot make use of certain features because the
            // necessary data is not authorized by the account owner.
            // For protocol fee withdrawals, `owner` and `to` are both address(0).
            require(withdrawal.owner == withdrawal.to, "INVALID_WITHDRAWAL_ADDRESS");

            // Forced withdrawal fees are charged when the request is submitted.
            require(withdrawal.fee == 0, "FEE_NOT_ZERO");

            require(withdrawal.extraData.length == 0, "AUXILIARY_DATA_NOT_ALLOWED");

            ExchangeData.ForcedWithdrawal memory forcedWithdrawal =
                S.pendingForcedWithdrawals[withdrawal.accountID][withdrawal.tokenID];

            if (forcedWithdrawal.timestamp != 0) {
                if (withdrawal.withdrawalType == 2) {
                    require(withdrawal.owner == forcedWithdrawal.owner, "INCONSISENT_OWNER");
                } else { //withdrawal.withdrawalType == 3
                    require(withdrawal.owner != forcedWithdrawal.owner, "INCONSISENT_OWNER");
                    require(withdrawal.amount == 0, "UNAUTHORIZED_WITHDRAWAL");
                }

                // Get the fee
                feeETH = forcedWithdrawal.fee;

                // delete the withdrawal request and free a slot
                delete S.pendingForcedWithdrawals[withdrawal.accountID][withdrawal.tokenID];
                S.numPendingForcedTransactions--;

                /*emit ForcedWithdrawalProcessed(
                    withdrawal.accountID,
                    withdrawal.tokenID,
                    withdrawal.amount
                );*/
            } else {
                // Allow the owner to submit full withdrawals without authorization
                // - when in shutdown mode
                // - to withdraw protocol fees
                require(
                    withdrawal.accountID == ExchangeData.ACCOUNTID_PROTOCOLFEE() ||
                    S.isShutdown(),
                    "FULL_WITHDRAWAL_UNAUTHORIZED"
                );
            }
        } else {
            revert("INVALID_WITHDRAWAL_TYPE");
        }

        // Check if there is a withdrawal recipient
        address recipient = S.withdrawalRecipient[withdrawal.owner][withdrawal.to][withdrawal.tokenID][withdrawal.amount][withdrawal.nonce];
        if (recipient != address(0)) {
            // Auxiliary data is not supported
            require (withdrawal.extraData.length == 0, "AUXILIARY_DATA_NOT_ALLOWED");

            // Set the new recipient address
            withdrawal.to = recipient;
            // Allow any amount of gas to be used on this withdrawal (which allows the transfer to be skipped)
            withdrawal.minGas = 0;

            delete S.withdrawalRecipient[withdrawal.owner][withdrawal.to][withdrawal.tokenID][withdrawal.amount][withdrawal.nonce];
        }

        // Validate gas provided
        require(auxData.gasLimit >= withdrawal.minGas, "OUT_OF_GAS_FOR_WITHDRAWAL");

        // Try to transfer the tokens with the provided gas limit
        S.distributeWithdrawal(
            withdrawal.owner,
            withdrawal.to,
            withdrawal.tokenID,
            withdrawal.amount,
            withdrawal.extraData,
            auxData.gasLimit
        );
    }

    function readTx(
        bytes memory data,
        uint         offset
        )
        internal
        pure
        returns (Withdrawal memory withdrawal)
    {
        // Extract the transfer data
        // We don't use abi.decode for this because of the large amount of zero-padding
        // bytes the circuit would also have to hash.
        withdrawal.withdrawalType = data.toUint8(offset);
        offset += 1;
        withdrawal.owner = data.toAddress(offset);
        offset += 20;
        withdrawal.accountID = data.toUint32(offset);
        offset += 4;
        withdrawal.tokenID = data.toUint16(offset);
        offset += 2;
        withdrawal.amount = data.toUint96(offset);
        offset += 12;
        withdrawal.feeTokenID = data.toUint16(offset);
        offset += 2;
        withdrawal.fee = uint(data.toUint16(offset)).decodeFloat(16);
        offset += 2;
        withdrawal.nonce = data.toUint32(offset);
        offset += 4;
        withdrawal.onchainDataHash = data.toBytes20(offset);
        offset += 20;
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
                    withdrawal.owner,
                    withdrawal.accountID,
                    withdrawal.tokenID,
                    withdrawal.amount,
                    withdrawal.feeTokenID,
                    withdrawal.fee,
                    withdrawal.to,
                    keccak256(withdrawal.extraData),
                    withdrawal.minGas,
                    withdrawal.validUntil,
                    withdrawal.nonce
                )
            )
        );
    }
}
