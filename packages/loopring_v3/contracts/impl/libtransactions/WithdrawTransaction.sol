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

import "../libexchange/ExchangeMode.sol";
import "../libexchange/ExchangeWithdrawals.sol";


/// @title WithdrawTransaction
/// @author Brecht Devos - <brecht@loopring.org>
/// @dev Four types of withdrawals are supported:
///     withdrawalType = 0: offchain withdrawal with EdDSA signature
///     withdrawalType = 1: offchian withdrawal with ECDSA signature or onchain withdrawl hash authorization.
///     withdrawalType = 2: onchain forced full-amount withdrawal by and to the owner
///     withdrawalType = 3: operator initiated full-amount withdrawal in shutdown mode.
library WithdrawTransaction
{
    using BytesUtil            for bytes;
    using FloatUtil            for uint;
    using MathUint             for uint;
    using SignatureUtil        for bytes32;
    using ExchangeMode         for ExchangeData.State;
    using ExchangeWithdrawals  for ExchangeData.State;

    bytes32 constant public WITHDRAWAL_TYPEHASH = keccak256(
        "Withdrawal(address owner,uint24 accountID,uint32 nonce,uint16 tokenID,uint256 amount,uint16 feeTokenID,uint256 fee,address to,bytes32 dataHash,uint24 minGas)"
    );

    struct Withdrawal
    {
        uint    withdrawalType;
        address owner;
        uint24  accountID;
        uint32  nonce;
        uint16  tokenID;
        uint    amount;
        uint16  feeTokenID;
        uint    fee;
        address to;
        bytes32 dataHash;
        uint24  minGas;
    }

    // Auxiliary data for each withdrawal
    struct WithdrawalAuxiliaryData
    {
        uint  gasLimit;
        bytes signature;
        bytes auxiliaryData;
    }

    event ForcedWithdrawalProcessed(
        uint24  indexed accountID,
        uint16          tokenID,
        uint            amount
    );

    function process(
        ExchangeData.State storage S,
        ExchangeData.BlockContext memory ctx,
        bytes memory data,
        bytes memory auxiliaryData
        )
        internal
        returns (uint feeETH)
    {
        Withdrawal memory withdrawal = readWithdrawal(data);

        WithdrawalAuxiliaryData memory auxData = abi.decode(auxiliaryData, (WithdrawalAuxiliaryData));

        if (withdrawal.withdrawalType == 0) {
            // Signature checked offchain, nothing to do
        } else if (withdrawal.withdrawalType == 1) {
            // Offchain withdrawal with ECDSA signature or hash authorization.

            // Calculate the tx hash
            bytes32 txHash = EIP712.hashPacked(
                ctx.DOMAIN_SEPARATOR,
                keccak256(
                    abi.encode(
                        WITHDRAWAL_TYPEHASH,
                        withdrawal.owner,
                        withdrawal.accountID,
                        withdrawal.nonce,
                        withdrawal.tokenID,
                        withdrawal.amount,
                        withdrawal.feeTokenID,
                        withdrawal.fee,
                        withdrawal.to,
                        withdrawal.dataHash,
                        withdrawal.minGas
                    )
                )
            );

            // Verify the signature if one is provided, otherwise fall back to an approved tx
            if (auxData.signature.length > 0) {
                require(
                    txHash.verifySignature(withdrawal.owner, auxData.signature),
                    "INVALID_SIGNATURE"
                );
            } else {
                require(S.approvedTx[withdrawal.owner][txHash], "TX_NOT_APPROVED");
                delete S.approvedTx[withdrawal.owner][txHash];
            }
        } else if (withdrawal.withdrawalType == 2 || withdrawal.withdrawalType == 3) {
            // Forced withdrawals cannot make use of certain features because the
            // necessary data is not authorized by the account owner.
            require(withdrawal.owner == withdrawal.to, "INVALID_WITHDRAWAL_ADDRESS");
            require(withdrawal.fee == 0, "FEE_NOT_ZERO");
            require(auxData.auxiliaryData.length == 0, "AUXILIARY_DATA_NOT_ALLOWED");

            ExchangeData.ForcedWithdrawal storage forcedWithdrawal =
                S.pendingForcedWithdrawals[withdrawal.accountID][withdrawal.tokenID];

            if (forcedWithdrawal.timestamp == 0) {
                // Allow the operator to submit full withdrawals without authorization
                // - when in shutdown mode
                // - to withdraw protocol fees
                require(withdrawal.accountID == 0 || S.isShutdown(), "FULL_WITHDRAWAL_UNAUTHORIZED");
            } else {
                // Type == 2: valid onchain withdrawal started by the owner
                // Type == 3: invalid onchain withdrawal started by someone else
                bool authorized = (withdrawal.owner == forcedWithdrawal.owner);

                require(authorized == (withdrawal.withdrawalType == 2), "INVALID_WITHDRAW_TYPE");
                require(authorized || withdrawal.amount == 0, "UNAUTHORIZED_WITHDRAWAL");

                // Get the fee
                feeETH = forcedWithdrawal.fee;

                // Reset the approval so it can't be used again
                delete S.pendingForcedWithdrawals[withdrawal.accountID][withdrawal.tokenID];

                // Open up a slot
                S.numPendingForcedTransactions--;

                emit ForcedWithdrawalProcessed(
                    withdrawal.accountID,
                    withdrawal.tokenID,
                    withdrawal.amount
                );
            }
        } else {
            revert("INVALID_WITHDRAWAL_TYPE");
        }

        // Validate gas provided
        require(auxData.gasLimit >= withdrawal.minGas, "INVALID_GAS_AMOUNT");
        // Validate the auxixliary withdrawal data
        if (withdrawal.dataHash == bytes32(0)) {
            require(auxData.auxiliaryData.length == 0, "AUXILIARY_DATA_NOT_ALLOWED");
        } else {
            require((uint(keccak256(auxData.auxiliaryData)) >> 3) == uint(withdrawal.dataHash), "INVALID_WITHDRAWAL_AUX_DATA");
        }

        // Try to transfer the tokens with the provided gas limit
        S.distributeWithdrawal(
            withdrawal.owner,
            withdrawal.to,
            withdrawal.tokenID,
            withdrawal.amount,
            auxData.auxiliaryData,
            auxData.gasLimit
        );
    }

    function readWithdrawal(
        bytes memory data
        )
        internal
        pure
        returns (Withdrawal memory)
    {
        uint offset = 1;

        uint withdrawalType = data.toUint8(offset);
        offset += 1;
        address owner = data.toAddress(offset);
        offset += 20;
        uint24 accountID = data.toUint24(offset);
        offset += 3;
        uint32 nonce = data.toUint32(offset);
        offset += 4;
        uint16 tokenID = data.toUint16(offset) >> 4;
        uint16 feeTokenID = uint16(data.toUint16(offset + 1) & 0xFFF);
        offset += 3;
        uint amount = data.toUint96(offset);
        offset += 12;
        uint fee = uint(data.toUint16(offset)).decodeFloat(16);
        offset += 2;
        address to = data.toAddress(offset);
        offset += 20;
        bytes32 dataHash = data.toBytes32(offset);
        offset += 32;
        uint24 minGas = data.toUint24(offset);
        offset += 3;

        return Withdrawal({
            withdrawalType: withdrawalType,
            owner: owner,
            accountID: accountID,
            nonce: nonce,
            tokenID: tokenID,
            amount: amount,
            feeTokenID: feeTokenID,
            fee: fee,
            to: to,
            dataHash: dataHash,
            minGas: minGas
        });
    }
}
