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
        S.checkPoolTxApproval(
            exit.owner,
            AmmExitRequest.hash(ctx.domainSeparator, exit),
            signature
        );

        bool burnFromLayer1 = (
            exit.direction == AmmData.Direction.L1_TO_L1 ||
            exit.direction == AmmData.Direction.L1_TO_L2
        );

        if (burnFromLayer1) {
            require(signature.length == 0, "LAYER1_EXIT_WITH_OFFCHAIN_APPROVAL_DISALLOWED");

            delete S.exitLockIdx[msg.sender];
            delete S.exitLocks[S.exitLocksIndex];
            S.exitLocksIndex++;
        }

        (bool slippageOK, uint96[] memory amounts) = _calculateExitAmounts(ctx, exit);

        if (!slippageOK) {
            if (burnFromLayer1) {
                address poolToken = address(this);
                S.balance[msg.sender][poolToken] = S.balance[msg.sender][poolToken].add(exit.burnAmount);
            }
            return;
        }

        // Handle liquidity tokens
        bool exitToLayer1 = (
            exit.direction == AmmData.Direction.L1_TO_L1 ||
            exit.direction == AmmData.Direction.L2_TO_L1
        );

        for (uint i = 0; i < ctx.size; i++) {
            uint96 amount = amounts[i];
            ctx.ammExpectedL2Balances[i] = ctx.ammExpectedL2Balances[i].sub(amount);

            if (exitToLayer1) {
                address token = ctx.tokens[i].addr;
                S.balance[exit.owner][token] = S.balance[exit.owner][token].add(amount);
            } else {
                ctx.ammActualL2Balances[i] = ctx.ammActualL2Balances[i].sub(amount);

                TransferTransaction.Transfer memory transfer = ctx._block.readTransfer(ctx.txIdx++);
                ctx.numTransactionsConsumed++;

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

                transfer.validUntil = 0xffffffff;
                bytes32 txHash = TransferTransaction.hashTx(ctx.exchangeDomainSeparator, transfer);
                ctx.exchange.approveTransaction(address(this), txHash);
            }
        }

        // Handle pool token
        ctx.totalSupply = ctx.totalSupply.sub(exit.burnAmount);

        if (burnFromLayer1) {
            S.burn(address(this), exit.burnAmount);
        } else {
            _approvePoolTokenWithdrawal(ctx, exit.burnAmount, exit.owner, exit.burnStorageID, signature);
        }
    }

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
