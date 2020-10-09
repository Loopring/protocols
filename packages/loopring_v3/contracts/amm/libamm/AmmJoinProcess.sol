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
        AmmData.State       storage /*S*/,
        AmmData.Context     memory  ctx,
        ExchangeData.Block  memory  _block,
        AmmData.PoolJoin    memory  join,
        bytes               memory  signature
        )
        internal
    {
        require(join.validUntil >= block.timestamp, "EXPIRED");

        bytes32 txHash = AmmJoinRequest.hash(ctx.domainSeparator, join);
        require(txHash.verifySignature(join.owner, signature), "INVALID_JOIN_APPROVAL");

        // Check if the requirements are fulfilled
        (bool slippageOK, uint96 mintAmount, uint96[] memory amounts) = _calculateJoinAmounts(ctx, join);
        require(slippageOK, "JOIN_SLIPPAGE_INVALID");

        // Handle liquidity tokens
        for (uint i = 0; i < ctx.tokens.length; i++) {
            TransferTransaction.Transfer memory transfer = _block.readTransfer(ctx.txIdx++);

            require(
                // transfer.fromAccountID == UNKNOWN &&
                transfer.toAccountID == ctx.accountID &&
                transfer.from == join.owner &&
                transfer.to == address(this) &&
                transfer.tokenID == ctx.tokens[i].tokenID &&
                transfer.amount.isAlmostEqualAmount(amounts[i]) &&
                transfer.feeTokenID == ctx.tokens[i].tokenID &&
                transfer.fee.isAlmostEqualFee(join.joinFees[i]) &&
                (signature.length == 0 || transfer.storageID == join.joinStorageIDs[i]),
                "INVALID_TX_DATA"
            );

            ctx.approveTransfer(transfer);

            ctx.tokenBalancesL2[i] = ctx.tokenBalancesL2[i].add(transfer.amount);
        }

        _mintPoolTokenOnL2(ctx, _block, mintAmount, join.owner);

        // emit JoinProcessed(join.owner, mintAmount, amounts);
    }

    function _mintPoolTokenOnL2(
        AmmData.Context     memory  ctx,
        ExchangeData.Block  memory  _block,
        uint96                      amount,
        address                     to
        )
        private
        view
    {
        TransferTransaction.Transfer memory transfer = _block.readTransfer(ctx.txIdx++);

        require(
            transfer.fromAccountID == ctx.accountID &&
            // transfer.toAccountID == UNKNOWN &&
            transfer.from == address(this) &&
            transfer.to == to &&
            transfer.tokenID == ctx.poolTokenID &&
            transfer.amount.isAlmostEqualAmount(amount) &&
            transfer.feeTokenID == 0 &&
            transfer.fee == 0,
            // transfer.storageID == UNKNOWN &&
            "INVALID_TX_DATA"
        );

        ctx.approveTransfer(transfer);

        // Update pool balance
        ctx.totalSupply = ctx.totalSupply.add(transfer.amount);
    }

    function _calculateJoinAmounts(
        AmmData.Context  memory  ctx,
        AmmData.PoolJoin memory  join
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
            return(true, AmmData.POOL_TOKEN_BASE().toUint96(), join.joinAmounts);
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
        uint ratio = uint(AmmData.POOL_TOKEN_BASE()).mul(mintAmount) / ctx.totalSupply;

        for (uint i = 0; i < ctx.tokens.length; i++) {
            amounts[i] = (ratio.mul(ctx.tokenBalancesL2[i]) / AmmData.POOL_TOKEN_BASE()).toUint96();
        }

        slippageOK = (mintAmount >= join.mintMinAmount);
        return (slippageOK, mintAmount, amounts);
    }
}
