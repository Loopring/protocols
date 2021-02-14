// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../aux/transactions/TransactionReader.sol";
import "../../core/impl/libtransactions/TransferTransaction.sol";
import "../../lib/EIP712.sol";
import "../../lib/ERC20SafeTransfer.sol";
import "../../lib/MathUint.sol";
import "../../lib/MathUint96.sol";
import "../../lib/SignatureUtil.sol";
import "../../thirdparty/SafeCast.sol";
import "./AmmUtil.sol";
import "./AmmData.sol";
import "./AmmExitRequest.sol";
import "./AmmPoolToken.sol";


/// @title AmmExitProcess
library AmmExitProcess
{
    using AmmPoolToken      for AmmData.State;
    using AmmUtil           for AmmData.Context;
    using AmmUtil           for uint96;
    using ERC20SafeTransfer for address;
    using MathUint          for uint;
    using MathUint96        for uint96;
    using SafeCast          for uint;
    using SignatureUtil     for bytes32;
    using TransactionReader for ExchangeData.Block;

    event ForcedExitProcessed(address owner, uint96 burnAmount, uint96[] amounts);

    function processExit(
        AmmData.State       storage S,
        AmmData.Context     memory  ctx,
        bytes               memory  txsData,
        AmmData.PoolExit    memory  exit,
        bytes               memory  signature
        )
        internal
    {
        require(exit.validUntil >= block.timestamp, "EXPIRED");
        require(exit.burnAmount > 0, "ZERO_BURN_AMOUNT");

        bytes32 txHash = AmmExitRequest.hash(ctx.domainSeparator, exit);
        bool isForcedExit = false;

        if (signature.length == 0) {
            bytes32 forcedExitHash = AmmExitRequest.hash(ctx.domainSeparator, S.forcedExit[exit.owner]);
            if (txHash == forcedExitHash) {
                delete S.forcedExit[exit.owner];
                S.forcedExitCount--;
                isForcedExit = true;
            } else {
                require(S.approvedTx[txHash], "INVALID_ONCHAIN_APPROVAL");
                delete S.approvedTx[txHash];
            }
        } else if (signature.length == 1) {
            ctx.verifySignatureL2(txsData, exit.owner, txHash, signature);
        } else {
            require(txHash.verifySignature(exit.owner, signature), "INVALID_OFFCHAIN_APPROVAL");
        }

        (bool slippageOK, uint96[] memory amounts) = _calculateExitAmounts(ctx, exit);

        TransferTransaction.Transfer memory transfer;
        if (isForcedExit) {
            if (!slippageOK) {
                AmmUtil.transferOut(address(this), exit.burnAmount, exit.owner);
                emit ForcedExitProcessed(exit.owner, 0, new uint96[](0));
                return;
            }

            ctx.totalSupply = ctx.totalSupply.sub(exit.burnAmount);
        } else {
            require(slippageOK, "EXIT_SLIPPAGE_INVALID");
            _burnPoolTokenOnL2(ctx, txsData, exit.burnAmount, exit.owner, exit.burnStorageID, signature, transfer);
        }

        // Handle liquidity tokens
        for (uint i = 0; i < ctx.tokens.length; i++) {
            TransferTransaction.readTx(txsData, ctx.txIdx++ * ExchangeData.TX_DATA_AVAILABILITY_SIZE + 1, transfer);

            require(
                transfer.fromAccountID == ctx.accountID &&
                // transfer.toAccountID == UNKNOWN &&
                // transfer.storageID == UNKNOWN &&
                transfer.from == address(this) &&
                transfer.to == exit.owner &&
                transfer.tokenID == ctx.tokens[i].tokenID &&
                transfer.amount.add(transfer.fee).isAlmostEqualAmount(amounts[i]),
                "INVALID_EXIT_TRANSFER_TX_DATA"
            );

            if (transfer.fee > 0) {
                require(
                    i == ctx.tokens.length - 1 &&
                    transfer.feeTokenID == ctx.tokens[i].tokenID &&
                    transfer.fee <= exit.fee,
                    "INVALID_FEES"
                );
            }

            ctx.tokenBalancesL2[i] = ctx.tokenBalancesL2[i].sub(transfer.amount);
        }

        if (isForcedExit) {
            emit ForcedExitProcessed(exit.owner, exit.burnAmount, amounts);
        }
    }

    function _burnPoolTokenOnL2(
        AmmData.Context     memory  ctx,
        bytes               memory  txsData,
        uint96                      amount,
        address                     from,
        uint32                      burnStorageID,
        bytes               memory  signature,
        TransferTransaction.Transfer memory transfer
        )
        internal
        view
    {
        TransferTransaction.readTx(txsData, ctx.txIdx++ * ExchangeData.TX_DATA_AVAILABILITY_SIZE + 1, transfer);

        require(
            // transfer.fromAccountID == UNKNOWN &&
            transfer.toAccountID == ctx.accountID &&
            transfer.from == from &&
            transfer.to == address(this) &&
            transfer.tokenID == ctx.poolTokenID &&
            transfer.amount.isAlmostEqualAmount(amount) &&
            transfer.feeTokenID == 0 &&
            transfer.fee == 0 &&
            (signature.length == 0 || transfer.storageID == burnStorageID),
            "INVALID_BURN_TX_DATA"
        );

        // Update pool balance
        ctx.totalSupply = ctx.totalSupply.sub(transfer.amount);
    }

    function _calculateExitAmounts(
        AmmData.Context  memory  ctx,
        AmmData.PoolExit memory  exit
        )
        private
        pure
        returns(
            bool /* slippageOK */,
            uint96[] memory amounts
        )
    {
        amounts = new uint96[](ctx.tokens.length);

        // Calculate how much will be withdrawn
        uint ratio = uint(AmmData.POOL_TOKEN_BASE()).mul(exit.burnAmount) / ctx.totalSupply;

        for (uint i = 0; i < ctx.tokens.length; i++) {
            amounts[i] = (ratio.mul(ctx.tokenBalancesL2[i]) / AmmData.POOL_TOKEN_BASE()).toUint96();
            if (amounts[i] < exit.exitMinAmounts[i]) {
                return (false, amounts);
            }
        }

        return (true, amounts);
    }
}
