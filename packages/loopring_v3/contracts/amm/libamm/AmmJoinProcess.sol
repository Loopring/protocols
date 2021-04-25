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
    using AmmUtil           for AmmData.Context;
    using AmmUtil           for uint96;
    using MathUint          for uint;
    using MathUint96        for uint96;
    using SafeCast          for uint;
    using SignatureUtil     for bytes32;
    using TransactionReader for ExchangeData.Block;

    // event JoinProcessed(address owner, uint96 mintAmount, uint96[] amounts);

    function processJoin(
        AmmData.State    storage S,
        AmmData.Context  memory  ctx,
        AmmData.PoolJoin memory  join,
        bytes            memory  signature
        )
        internal
    {
        require(join.validUntil >= block.timestamp, "EXPIRED");

        bytes32 txHash = AmmJoinRequest.hash(ctx.domainSeparator, join);
        if (signature.length == 0) {
            require(S.approvedTx[txHash], "INVALID_ONCHAIN_APPROVAL");
            delete S.approvedTx[txHash];
        } else if (signature.length == 1) {
            ctx.verifySignatureL2(join.owner, txHash, signature);
        } else {
            require(txHash.verifySignature(join.owner, signature), "INVALID_OFFCHAIN_L1_APPROVAL");
        }

        // Check if the requirements are fulfilled
        (bool slippageOK, uint96 mintAmount, uint96[] memory amounts) = _calculateJoinAmounts(ctx, join);
        require(slippageOK, "JOIN_SLIPPAGE_INVALID");

        // Process transfers
        _processJoinTransfers(ctx, join, amounts, signature);
        _mintPoolTokenOnL2(ctx, mintAmount, join.owner);

        // emit JoinProcessed(join.owner, mintAmount, amounts);
    }

    function _processJoinTransfers(
        AmmData.Context  memory ctx,
        AmmData.PoolJoin memory join,
        uint96[]         memory amounts,
        bytes            memory signature
        )
        private
        view
    {
        // Handle liquidity tokens
        for (uint i = 0; i < ctx.tokens.length; i++) {
            AmmData.Token memory token = ctx.tokens[i];

            // Read the transaction data
            (uint packedData, address to, address from) = AmmUtil.readTransfer(ctx);
            uint amount = (packedData >> 64) & 0xffffff;
            uint fee    = (packedData >> 32) & 0xffff;

            // Decode float
            amount = (amount & 524287) * (10 ** (amount >> 19));

            uint targetAmount = uint(amounts[i]);
            require(
                // txType == ExchangeData.TransactionType.TRANSFER &&
                // transfer.type == 1 &&
                // transfer.fromAccountID == UNKNOWN &&
                // transfer.toAccountID == ctx.accountID &&
                // transfer.tokenID == token.tokenID &&
                packedData & 0xffff00000000ffffffffffff0000000000000000000000 ==
                (uint(ExchangeData.TransactionType.TRANSFER) << 176) | (1 << 168) | (uint(ctx.accountID) << 104) | (uint(token.tokenID) << 88) &&
                (100000 - 8) * targetAmount <= amount * 100000 && amount * 100000 <= (100000 + 8) * targetAmount &&
                (signature.length == 0 || /*storageID*/(packedData & 0xffffffff) == join.joinStorageIDs[i]) &&
                from == join.owner &&
                to == address(this),
                "INVALID_JOIN_TRANSFER_TX_DATA"
            );

            if (fee > 0) {
                // Decode float
                fee = (fee & 2047) * (10 ** (fee >> 11));
                require(
                    i == ctx.tokens.length - 1 &&
                    /*feeTokenID*/(packedData >> 48) & 0xffff == token.tokenID &&
                    fee <= join.fee,
                    "INVALID_FEES"
                );
            }

            ctx.tokenBalancesL2[i] = ctx.tokenBalancesL2[i].add(uint96(amount));
        }
    }

    function _mintPoolTokenOnL2(
        AmmData.Context memory ctx,
        uint                   mintAmount,
        address                _to
        )
        private
        view
    {
        // Read the transaction data
        (uint packedData, address to, address from) = AmmUtil.readTransfer(ctx);
        uint amount = (packedData >> 64) & 0xffffff;
        // Decode float
        amount = (amount & 524287) * (10 ** (amount >> 19));

        require(
            // txType == ExchangeData.TransactionType.TRANSFER &&
            // transfer.type == 1 &&
            // transfer.fromAccountID == ctx.accountID &&
            // transfer.toAccountID == UNKNOWN &&
            // transfer.tokenID == ctx.poolTokenID &&
            packedData & 0xffffffffffff00000000ffff000000ffffffff00000000 ==
            (uint(ExchangeData.TransactionType.TRANSFER) << 176) | (1 << 168) | (uint(ctx.accountID) << 136) | (uint(ctx.poolTokenID) << 88) &&
            // transfer.amount.isAlmostEqualAmount(mintAmount) &&
            (100000 - 8) * mintAmount <= amount * 100000 && amount * 100000 <= (100000 + 8) * mintAmount &&
            to == _to &&
            from == address(this),
            "INVALID_MINT_TX_DATA"
        );

        // Update pool balance
        ctx.totalSupply = ctx.totalSupply.add(uint96(amount));
    }

    function _calculateJoinAmounts(
        AmmData.Context  memory ctx,
        AmmData.PoolJoin memory join
        )
        private
        pure
        returns(
            bool            slippageOK,
            uint96          mintAmount,
            uint96[] memory amounts
        )
    {
        // Check if we can still use this join
        amounts = new uint96[](ctx.tokens.length);

        if (ctx.totalSupply == 0) {
            return(true, AmmData.POOL_TOKEN_BASE.toUint96(), join.joinAmounts);
        }

        // Calculate the amount of pool tokens that should be minted
        bool initialized = false;
        for (uint i = 0; i < ctx.tokens.length; i++) {
            if (ctx.tokenBalancesL2[i] > 0) {
                uint amountOut = uint(join.joinAmounts[i])
                    .mul(ctx.totalSupply) / uint(ctx.tokenBalancesL2[i]);

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
        uint ratio = uint(AmmData.POOL_TOKEN_BASE).mul(mintAmount) / ctx.totalSupply;

        for (uint i = 0; i < ctx.tokens.length; i++) {
            amounts[i] = (ratio.mul(ctx.tokenBalancesL2[i]) / AmmData.POOL_TOKEN_BASE).toUint96();
        }

        slippageOK = (mintAmount >= join.mintMinAmount);
        return (slippageOK, mintAmount, amounts);
    }
}
