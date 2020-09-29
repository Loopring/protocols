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
import "./AmmData.sol";
import "./AmmJoinRequest.sol";
import "./AmmPoolToken.sol";
import "./AmmStatus.sol";
import "./AmmUtil.sol";


/// @title AmmJoinProcess
library AmmJoinProcess
{
    using AmmPoolToken      for AmmData.State;
    using AmmStatus         for AmmData.State;
    using AmmUtil           for uint96;
    using ERC20SafeTransfer for address;
    using MathUint          for uint;
    using MathUint96        for uint96;
    using SafeCast          for uint;
    using TransactionReader for ExchangeData.Block;

    function processJoin(
        AmmData.State    storage S,
        AmmData.Context  memory  ctx,
        AmmData.PoolJoin memory  join,
        bytes            memory  signature
        )
        internal
        returns(AmmData.PoolTokenTransfer memory ptt)
    {
        if (join.joinFromLayer2) {
            require(signature.length != 0, "NOT_ALLOWED");
        } else {
            require(signature.length == 0, "NOT_ALLOWED");
        }

        S.validatePoolTransaction(
            join.owner,
            AmmJoinRequest.hashPoolJoin(ctx.domainSeparator, join),
            signature
        );

        // Check if the requirements are fulfilled
        // TODO(daniel): change poolAmountOut to uint96
        (bool slippageRequirementMet, uint poolAmountOut, uint96[] memory amounts) = _calculateJoinAmounts(S, ctx, join);

        if (!slippageRequirementMet) ptt;

        // Handle pool token
        if (join.mintToLayer2) {
            S.mint(address(this), poolAmountOut);
            // The following will trigger a pool token deposit to the user's layer-2 account
            ctx.ammExpectedL2Balances[0] = ctx.ammExpectedL2Balances[0].add(poolAmountOut.toUint96());
            ptt.amount = poolAmountOut.toUint96();
            ptt.to = join.owner;
        } else {
            S.mint(join.owner, poolAmountOut);
        }

         // Handle liquidity tokens
        for (uint i = 1; i < ctx.size; i++) {
            uint96 amount = amounts[i - 1];
            ctx.ammExpectedL2Balances[i] = ctx.ammExpectedL2Balances[i].add(amount);

            if (join.joinFromLayer2) {
                TransferTransaction.Transfer memory transfer = ctx._block.readTransfer(ctx.txIdx++);
                ctx.numTransactionsConsumed++;

                // We do not check these fields: fromAccountID, to, amount, fee, storageID
                require(
                    transfer.toAccountID== ctx.accountID &&
                    transfer.from == join.owner &&
                    transfer.tokenID == ctx.tokens[i].tokenID &&
                    transfer.amount.isAlmostEqual(amount) &&
                    transfer.feeTokenID == ctx.tokens[i].tokenID &&
                    transfer.fee.isAlmostEqual(join.fees[i]),
                    "INVALID_TX_DATA"
                );

                // Now approve this transfer
                transfer.validUntil = 0xffffffff;
                bytes32 txHash = TransferTransaction.hashTx(ctx.exchangeDomainSeparator, transfer);
                ctx.exchange.approveTransaction(join.owner, txHash);

                ctx.ammActualL2Balances[i] = ctx.ammActualL2Balances[i].add(amount);
            }
        }
    }

    function processExchangeDeposit(
        AmmData.Context  memory  ctx,
        AmmData.Token    memory  token,
        uint96                   amount
        )
        internal
    {
        require(amount > 0, "INVALID_DEPOSIT_AMOUNT");

        // Check that the deposit in the block matches the expected deposit
        DepositTransaction.Deposit memory deposit = ctx._block.readDeposit(ctx.txIdx++);
        ctx.numTransactionsConsumed++;

        require(
            deposit.owner == address(this) &&
            deposit.accountID== ctx.accountID &&
            deposit.tokenID == token.tokenID &&
            deposit.amount == amount,
            "INVALID_TX_DATA"
        );

        // Now do this deposit
        uint ethValue = 0;
        if (token.addr == address(0)) {
            ethValue = amount;
        } else {
            // TODO(daniel): use try-catch?
            uint allowance = ERC20(token.addr).allowance(address(this), ctx.exchangeDepositContract);
            if (allowance < amount) {
                // Approve the deposit transfer
                ERC20(token.addr).approve(ctx.exchangeDepositContract, uint(-1));
            }
        }

        ctx.exchange.deposit{value: ethValue}(
            deposit.owner,
            deposit.owner,
            token.addr,
            deposit.amount,
            new bytes(0)
        );
    }

    function processPoolTokenTransfer(
        AmmData.Context           memory  ctx,
        AmmData.PoolTokenTransfer memory  poolTokenTransfer
        )
        internal
    {
            TransferTransaction.Transfer memory transfer = ctx._block.readTransfer(ctx.txIdx++);
            ctx.numTransactionsConsumed++;

            // We do not check these fields: toAccountID, storageID
            require(
                transfer.to == poolTokenTransfer.to &&
                transfer.from == address(this) &&
                transfer.fromAccountID == ctx.accountID &&
                transfer.tokenID == ctx.tokens[0].tokenID &&
                transfer.amount.isAlmostEqual(poolTokenTransfer.amount) &&
                transfer.feeTokenID == 0 &&
                transfer.fee == 0,
                "INVALID_TX_DATA"
            );

            // Now approve this transfer
            transfer.validUntil = 0xffffffff;
            bytes32 txHash = TransferTransaction.hashTx(ctx.exchangeDomainSeparator, transfer);
            ctx.exchange.approveTransaction(address(this), txHash);
    }

    function _calculateJoinAmounts(
        AmmData.State    storage S,
        AmmData.Context  memory  ctx,
        AmmData.PoolJoin memory  join
        )
        private
        view
        returns(
            bool            slippageRequirementMet,
            uint            poolAmountOut,
            uint96[] memory amounts
        )
    {
        // Check if we can still use this join
        amounts = new uint96[](ctx.size - 1);
        uint _totalSupply = S.totalSupply.sub(S.poolAmountToBurn);

        if (block.timestamp > join.validUntil) {
            return (false, 0, amounts);
        }

        if (_totalSupply == 0) {
            return(true, ctx.poolTokenInitialSupply, join.maxAmountsIn);
        }

        // Calculate the amount of pool tokens that should be minted
        bool initialized = false;
        for (uint i = 1; i < ctx.size; i++) {
            if (ctx.ammExpectedL2Balances[i] > 0) {
                uint amountOut = uint(join.maxAmountsIn[i - 1])
                    .mul(_totalSupply) / uint(ctx.ammExpectedL2Balances[i]);

                if (!initialized) {
                    initialized = true;
                    poolAmountOut = amountOut;
                } else if (amountOut < poolAmountOut) {
                    poolAmountOut = amountOut;
                }
            }
        }

        if (poolAmountOut == 0) {
            return (false, 0, amounts);
        }

        // Calculate the amounts to deposit
        uint ratio = poolAmountOut.mul(ctx.poolTokenBase) / _totalSupply;

        for (uint i = 1; i < ctx.size; i++) {
            amounts[i - 1] = ratio.mul(ctx.ammExpectedL2Balances[i] / ctx.poolTokenBase).toUint96();
        }

        slippageRequirementMet = (poolAmountOut >= join.minPoolAmountOut);
        return (slippageRequirementMet, poolAmountOut, amounts);
    }
}
