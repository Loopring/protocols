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
    {
        if (join.direction == AmmData.Direction.L1_TO_L1 ||
            join.direction == AmmData.Direction.L1_TO_L2) {
            require(signature.length == 0, "JOIN_FROM_L1_NEEDS_ONCHAIN_APPROVAL");
        }

        if (signature.length > 0) {
            require(join.index == 0, "INVALID_JOIN_INDEX");
        } else {
            require(join.index > 0, "INVALID_JOIN_INDEX");
        }

        S.validatePoolTransaction(
            join.owner,
            AmmJoinRequest.hash(ctx.domainSeparator, join),
            signature
        );

        // Check if the requirements are fulfilled
        (bool slippageOK, uint96 mintAmount, uint96[] memory amounts) = _calculateJoinAmounts(ctx, join);

        if (!slippageOK) return;

        if (signature.length == 0) {
            AmmData.User storage user = S.userMap[msg.sender];
            delete user.lockRecords[join.index - 1];
        }

         // Handle liquidity tokens
        for (uint i = 1; i < ctx.size; i++) {
            uint96 amount = amounts[i - 1];
            ctx.ammExpectedL2Balances[i] = ctx.ammExpectedL2Balances[i].add(amount);

        if (join.direction == AmmData.Direction.L2_TO_L1 ||
            join.direction == AmmData.Direction.L2_TO_L2) {
                ctx.ammActualL2Balances[i] = ctx.ammActualL2Balances[i].add(amount);

                TransferTransaction.Transfer memory transfer = ctx._block.readTransfer(ctx.txIdx++);
                ctx.numTransactionsConsumed++;

                // The following fields are not loaded from readTransfer
                transfer.validUntil = 0xffffffff;

                // We do not check these fields: fromAccountID, to, amount, fee, storageID
                require(
                    transfer.toAccountID== ctx.accountID &&
                    transfer.from == join.owner &&
                    transfer.tokenID == ctx.tokens[i].tokenID &&
                    transfer.amount.isAlmostEqual(amount) &&
                    transfer.feeTokenID == ctx.tokens[i].tokenID &&
                    transfer.fee.isAlmostEqual(join.joinFees[i]),
                    "INVALID_TX_DATA"
                );


                if (i == 1 && signature.length > 0) {
                    require(transfer.storageID == join.joinStorageID, "INVALID_STORAGE_ID_OR_REPLAY");
                }

                bytes32 txHash = TransferTransaction.hashTx(ctx.exchangeDomainSeparator, transfer);
                ctx.exchange.approveTransaction(join.owner, txHash);
            }
        }

        // Handle pool token
        ctx.totalSupply = ctx.totalSupply.add(mintAmount);
        if (join.direction == AmmData.Direction.L1_TO_L2 ||
            join.direction == AmmData.Direction.L2_TO_L2) {
            _approvePoolTokenDeposit(ctx, mintAmount, join.owner);
        } else {
            S.mint(join.owner, mintAmount);
        }
    }

    function approveTokenDeposit(
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

    function _approvePoolTokenDeposit(
        AmmData.Context  memory  ctx,
        uint96                   amount,
        address                  to
        )
        private
    {
        require(amount > 0, "INVALID_DEPOSIT_AMOUNT");

        // Check that the deposit in the block matches the expected deposit
        DepositTransaction.Deposit memory deposit = ctx._block.readDeposit(ctx.txIdx++);
        ctx.numTransactionsConsumed++;

        require(
            deposit.owner == address(this) &&
            deposit.accountID== ctx.accountID &&
            deposit.tokenID == ctx.tokens[0].tokenID &&
            deposit.amount == amount,
            "INVALID_TX_DATA"
        );

        ctx.exchange.deposit{value: 0}(
            deposit.owner,
            to,
            ctx.tokens[0].addr,
            deposit.amount,
            new bytes(0)
        );
    }

    function _calculateJoinAmounts(
        AmmData.Context  memory  ctx,
        AmmData.PoolJoin memory  join
        )
        private
        view
        returns(
            bool            slippageOK,
            uint96          mintAmount,
            uint96[] memory amounts
        )
    {
        // Check if we can still use this join
        amounts = new uint96[](ctx.size - 1);

        if (block.timestamp > join.validUntil) {
            return (false, 0, amounts);
        }

        if (ctx.totalSupply == 0) {
            return(true, ctx.poolTokenInitialSupply.toUint96(), join.joinAmounts);
        }

        // Calculate the amount of pool tokens that should be minted
        bool initialized = false;
        for (uint i = 1; i < ctx.size; i++) {
            if (ctx.ammExpectedL2Balances[i] > 0) {
                uint amountOut = uint(join.joinAmounts[i - 1])
                    .mul(ctx.totalSupply) / uint(ctx.ammExpectedL2Balances[i]);

                if (!initialized) {
                    initialized = true;
                    mintAmount = amountOut.toUint96();
                } else if (amountOut < mintAmount) {
                    mintAmount = amountOut.toUint96();
                }
            }
        }

        if (mintAmount == 0) {
            return (false, 0, amounts);
        }

        // Calculate the amounts to deposit
        uint ratio = ctx.poolTokenBase.mul(mintAmount) / ctx.totalSupply;

        for (uint i = 1; i < ctx.size; i++) {
            amounts[i - 1] = ratio.mul(ctx.ammExpectedL2Balances[i] / ctx.poolTokenBase).toUint96();
        }

        slippageOK = (mintAmount >= join.mintMinAmount);
        return (slippageOK, mintAmount, amounts);
    }
}
