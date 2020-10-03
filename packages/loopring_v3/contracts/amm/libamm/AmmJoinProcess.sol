// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../aux/transactions/TransactionReader.sol";
import "../../core/impl/libtransactions/TransferTransaction.sol";
import "../../lib/EIP712.sol";
import "../../lib/MathUint.sol";
import "../../lib/MathUint96.sol";
import "../../lib/SignatureUtil.sol";
import "../../thirdparty/SafeCast.sol";
import "./AmmData.sol";
import "./AmmJoinRequest.sol";
import "./AmmPoolToken.sol";
import "./AmmUtil.sol";


/// @title AmmJoinProcess
library AmmJoinProcess
{
    using AmmPoolToken      for AmmData.State;
    using AmmUtil           for uint96;
    using MathUint          for uint;
    using MathUint96        for uint96;
    using SafeCast          for uint;
    using SignatureUtil     for bytes32;
    using TransactionReader for ExchangeData.Block;

    event JoinProcessed(address owner, uint96 mintAmount, uint96[] amounts);

    function processJoin(
        AmmData.State    storage S,
        AmmData.Context  memory  ctx,
        AmmData.PoolJoin memory  join,
        bytes            memory  signature
        )
        internal
    {
        bytes32 txHash = AmmJoinRequest.hash(ctx.domainSeparator, join);
        require(txHash.verifySignature(join.owner, signature), "INVALID_JOIN_APPROVAL");

        // Check if the requirements are fulfilled
        (bool slippageOK, uint96 mintAmount, uint96[] memory amounts) = _calculateJoinAmounts(ctx, join);
        require(slippageOK, "JOIN_SLIPPAGE_INVALID");

         // Handle liquidity tokens
        for (uint i = 0; i < ctx.size; i++) {
            TransferTransaction.Transfer memory transfer = ctx._block.readTransfer(ctx.txIdx++);

            require(
                // transfer.fromAccountID == UNKNOWN &&
                transfer.toAccountID== ctx.accountID &&
                transfer.from == join.owner &&
                transfer.to == address(this) &&
                transfer.tokenID == ctx.tokens[i].tokenID &&
                transfer.amount.isAlmostEqual(amounts[i]) &&
                transfer.feeTokenID == ctx.tokens[i].tokenID &&
                transfer.fee.isAlmostEqual(join.joinFees[i]) &&
                (signature.length == 0 || transfer.storageID == join.joinStorageIDs[i]),
                "INVALID_TX_DATA"
            );

            transfer.validUntil = 0xffffffff;
            bytes32 hash = TransferTransaction.hashTx(ctx.exchangeDomainSeparator, transfer);
            ctx.exchange.approveTransaction(join.owner, hash);

            ctx.layer2Balances[i] = ctx.layer2Balances[i].add(transfer.amount);
        }

        // Handle pool tokens
        S.mint(address(this), mintAmount);

        _approvePoolTokenDeposit(ctx, mintAmount, join.owner);

        emit JoinProcessed(join.owner, mintAmount, amounts);
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

        AmmData.Token memory poolToken = ctx.tokens[ctx.size];

        require(
            deposit.to == to &&
            deposit.tokenID == poolToken.tokenID &&
            deposit.amount == amount,
            "INVALID_TX_DATA"
        );

        ctx.exchange.deposit{value: 0}(
            address(this), // from
            to,
            poolToken.addr,
            amount,
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
        amounts = new uint96[](ctx.size);

        if (block.timestamp > join.validUntil) {
            return (false, 0, amounts);
        }

        if (ctx.effectiveTotalSupply == 0) {
            return(true, ctx.poolTokenInitialSupply.toUint96(), join.joinAmounts);
        }

        // Calculate the amount of pool tokens that should be minted
        bool initialized = false;
        for (uint i = 0; i < ctx.size; i++) {
            if (ctx.layer2Balances[i] > 0) {
                uint amountOut = uint(join.joinAmounts[i])
                    .mul(ctx.effectiveTotalSupply) / uint(ctx.layer2Balances[i]);

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
        uint ratio = ctx.poolTokenBase.mul(mintAmount) / ctx.effectiveTotalSupply;

        for (uint i = 0; i < ctx.size; i++) {
            amounts[i] = ratio.mul(ctx.layer2Balances[i] / ctx.poolTokenBase).toUint96();
        }

        slippageOK = (mintAmount >= join.mintMinAmount);
        return (slippageOK, mintAmount, amounts);
    }
}
