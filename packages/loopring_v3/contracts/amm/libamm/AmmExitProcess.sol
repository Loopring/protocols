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
import "../../thirdparty/SafeCast.sol";
import "./AmmUtil.sol";
import "./AmmData.sol";
import "./AmmExitRequest.sol";
import "./AmmPoolToken.sol";
import "./AmmStatus.sol";


/// @title AmmExitProcess
library AmmExitProcess
{
    using AmmPoolToken      for AmmData.State;
    using AmmStatus         for AmmData.State;
    using AmmUtil           for uint96;
    using ERC20SafeTransfer for address;
    using MathUint          for uint;
    using MathUint96        for uint96;
    using SafeCast          for uint;
    using TransactionReader for ExchangeData.Block;


    function processExit(
        AmmData.State    storage S,
        AmmData.Context  memory  ctx,
        AmmData.PoolExit memory  exit,
        bytes            memory  signature
        )
        internal
    {
        if (signature.length == 0) {
            require(exit.index > 0, "INDEX_REQUIRED");
        } else {
            require(exit.index == 0, "INDEX_DISALLOWED");
            require(
                exit.direction == AmmData.Direction.L2_TO_L1 ||
                exit.direction == AmmData.Direction.L2_TO_L2,
                "LAYER1_BURN_WITH_OFFCHAIN_APPROVAL_DISALLOWED"
            );
        }

        S.validatePoolTransaction(
            exit.owner,
            AmmExitRequest.hash(ctx.domainSeparator, exit),
            signature
        );

        (bool slippageOK, uint96[] memory amounts) = _calculateExitAmounts(ctx, exit);

        if (!slippageOK) return;


        if (signature.length == 0) {
            AmmData.User storage user = S.userMap[msg.sender];

            // Deleteting the lock record indicates a successful processing of the join.
            delete user.exitLocks[exit.index - 1];
        }


         // Handle liquidity tokens
        for (uint i = 1; i < ctx.size; i++) {
            uint96 amount = amounts[i - 1];
            ctx.ammExpectedL2Balances[i] = ctx.ammExpectedL2Balances[i].sub(amount);

            if (exit.direction == AmmData.Direction.L1_TO_L2 ||
                exit.direction == AmmData.Direction.L2_TO_L2) {

                ctx.ammActualL2Balances[i] = ctx.ammActualL2Balances[i].sub(amount);

                TransferTransaction.Transfer memory transfer = ctx._block.readTransfer(ctx.txIdx++);
                ctx.numTransactionsConsumed++;

                // The following fields are not loaded from readTransfer
                transfer.validUntil = 0xffffffff;

                require(
                    transfer.fromAccountID== ctx.accountID &&
                    transfer.from == address(this) &&
                    transfer.to == address(this) &&
                    transfer.tokenID == ctx.tokens[i].tokenID &&
                    transfer.amount.isAlmostEqual(amount) &&
                    transfer.feeTokenID == 0 &&
                    transfer.fee == 0,
                    "INVALID_TX_DATA"
                );

                bytes32 txHash = TransferTransaction.hashTx(ctx.exchangeDomainSeparator, transfer);
                ctx.exchange.approveTransaction(address(this), txHash);
            } else {
                AmmData.User storage user = S.userMap[exit.owner];
                address token = ctx.tokens[i].addr;
                user.withdrawable[token] = user.withdrawable[token].add(amount);
            }
        }

        // Handle pool token
        ctx.totalSupply = ctx.totalSupply.sub(exit.burnAmount);
        if (exit.direction == AmmData.Direction.L2_TO_L1 ||
            exit.direction == AmmData.Direction.L2_TO_L2) {
            _approvePoolTokenWithdrawal(ctx, exit.burnAmount, exit.owner, exit.burnStorageID, signature);
        } else {
            S.burn(address(this), exit.burnAmount);
        }
    }

    function approveTokenWithdrawal(
        AmmData.Context  memory  ctx,
        AmmData.Token    memory  token,
        uint                     amount
        )
        internal
    {
        // Check that the withdrawal in the block matches the expected withdrawal
        WithdrawTransaction.Withdrawal memory withdrawal = ctx._block.readWithdrawal(ctx.txIdx++);
        ctx.numTransactionsConsumed++;

        // These fields are not read by readWithdrawal: storageID
        withdrawal.minGas = 0;
        withdrawal.to = address(this);
        withdrawal.extraData = new bytes(0);

        require(
            withdrawal.withdrawalType == 1 &&
            withdrawal.owner == address(this) &&
            withdrawal.accountID== ctx.accountID &&
            withdrawal.tokenID == token.tokenID &&
            withdrawal.amount == amount && //No rounding errors because we put in the complete uint96 in the DA.
            withdrawal.feeTokenID == 0 &&
            withdrawal.fee == 0 &&
            withdrawal.onchainDataHash == WithdrawTransaction.hashOnchainData(
                withdrawal.minGas,
                withdrawal.to,
                withdrawal.extraData
            ),
            "INVALID_TX_DATA"
        );

        // Now approve this withdrawal
        withdrawal.validUntil = 0xffffffff;
        bytes32 txHash = WithdrawTransaction.hashTx(ctx.exchangeDomainSeparator, withdrawal);
        ctx.exchange.approveTransaction(address(this), txHash);
    }        // Exits burning pool tokens on layer-1 must be approved onchain.

    function _approvePoolTokenWithdrawal(
        AmmData.Context  memory  ctx,
        uint                     amount,
        address                  from,
        uint32                   burnStorageID,
        bytes            memory  signature
        )
        internal
    {
        // Check that the withdrawal in the block matches the expected withdrawal
        WithdrawTransaction.Withdrawal memory withdrawal = ctx._block.readWithdrawal(ctx.txIdx++);
        ctx.numTransactionsConsumed++;

        // These fields are not read by readWithdrawal: to, extraData, minGas, validUntil
        withdrawal.to = address(this);
        withdrawal.extraData = new bytes(0);
        withdrawal.minGas = 0;
        withdrawal.validUntil = 0xffffffff;

        bytes32 expectedOnchainDataHash = WithdrawTransaction.hashOnchainData(
            withdrawal.minGas,
            withdrawal.to,
            withdrawal.extraData
        );


        if (signature.length > 0) {
            require(withdrawal.storageID == burnStorageID, "INVALID_STORAGE_ID_OR_REPLAY");
        }

        require(
            withdrawal.withdrawalType == 1 &&
            withdrawal.owner == from &&
            withdrawal.accountID == 0 &&
            withdrawal.tokenID == ctx.tokens[0].tokenID &&
            withdrawal.amount == amount && //No rounding errors because we put in the complete uint96 in the DA.
            withdrawal.feeTokenID == 0 &&
            withdrawal.fee == 0 &&
            withdrawal.onchainDataHash == expectedOnchainDataHash,
            "INVALID_TX_DATA"
        );

        // Now approve this withdrawal
        bytes32 txHash = WithdrawTransaction.hashTx(ctx.exchangeDomainSeparator, withdrawal);
        ctx.exchange.approveTransaction(from, txHash);
    }

    function _calculateExitAmounts(
        AmmData.Context  memory  ctx,
        AmmData.PoolExit memory  exit
        )
        private
        view
        returns(
            bool /* slippageOK */,
            uint96[] memory amounts
        )
    {
        amounts = new uint96[](ctx.size - 1);

        // Check if we can still use this exit
        if (block.timestamp > exit.validUntil) {
            return (false, amounts);
        }

        // Calculate how much will be withdrawn
        uint ratio = ctx.poolTokenBase.mul(exit.burnAmount) / ctx.totalSupply;

        for (uint i = 0; i < ctx.size - 1; i++) {
            amounts[i] = (ratio.mul(ctx.ammExpectedL2Balances[i + 1]) / ctx.poolTokenBase).toUint96();
            if (amounts[i] < exit.exitMinAmounts[i]) {
                return (false, amounts);
            }
        }

        return (true, amounts);
    }
}
