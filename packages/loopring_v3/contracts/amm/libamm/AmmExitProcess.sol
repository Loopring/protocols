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
import "../../lib/TransferUtil.sol";
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
    using TransferUtil      for address;

    event ForcedExitProcessed(address owner, uint96 burnAmount, uint96[] amounts);

    function processExit(
        AmmData.State    storage S,
        AmmData.Context  memory  ctx,
        AmmData.PoolExit memory  exit,
        bytes            memory  signature
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
            ctx.verifySignatureL2(exit.owner, txHash, signature);
        } else {
            require(txHash.verifySignature(exit.owner, signature), "INVALID_OFFCHAIN_APPROVAL");
        }

        (bool slippageOK, uint96[] memory amounts) = _calculateExitAmounts(ctx, exit);

        if (isForcedExit) {
            if (!slippageOK) {
                address(this).transferOut(exit.owner, exit.burnAmount);
                emit ForcedExitProcessed(exit.owner, 0, new uint96[](0));
                return;
            }

            ctx.totalSupply = ctx.totalSupply.sub(exit.burnAmount);
        } else {
            require(slippageOK, "EXIT_SLIPPAGE_INVALID");
            _burnPoolTokenOnL2(ctx, exit.burnAmount, exit.owner, exit.burnStorageID, signature);
        }

        _processExitTransfers(ctx, exit, amounts);

        if (isForcedExit) {
            emit ForcedExitProcessed(exit.owner, exit.burnAmount, amounts);
        }
    }

    function _processExitTransfers(
        AmmData.Context  memory ctx,
        AmmData.PoolExit memory exit,
        uint96[]         memory amounts
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
            // Decode floats
            amount = (amount & 524287) * (10 ** (amount >> 19));
            fee = (fee & 2047) * (10 ** (fee >> 11));

            uint targetAmount = uint(amounts[i]);
            require(
                // txType == ExchangeData.TransactionType.TRANSFER &&
                // transfer.type == 1 &&
                // transfer.fromAccountID == ctx.accountID &&
                // transfer.toAccountID == UNKNOWN &&
                // transfer.tokenID == token.tokenID &&
                packedData & 0xffffffffffff00000000ffff0000000000000000000000 ==
                (uint(ExchangeData.TransactionType.TRANSFER) << 176) | (1 << 168) | (uint(ctx.accountID) << 136) | (uint(token.tokenID) << 88) &&
                // transfer.amount.add(transfer.fee).isAlmostEqualAmount(amounts[i])
                (100000 - 8) * targetAmount <= (amount + fee) * 100000 && (amount + fee) * 100000 <= (100000 + 8) * targetAmount &&
                from == address(this) &&
                to == exit.owner,
                "INVALID_EXIT_TRANSFER_TX_DATA"
            );

            if (fee > 0) {
                require(
                    i == ctx.tokens.length - 1 &&
                    /*feeTokenID*/(packedData >> 48) & 0xffff == token.tokenID &&
                    fee <= exit.fee,
                    "INVALID_FEES"
                );
            }

            ctx.tokenBalancesL2[i] = ctx.tokenBalancesL2[i].sub(uint96(amount));
        }
    }

    function _burnPoolTokenOnL2(
        AmmData.Context memory ctx,
        uint96                 burnAmount,
        address                _from,
        uint32                 burnStorageID,
        bytes           memory signature
        )
        internal
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
            // transfer.fromAccountID == UNKNOWN &&
            // transfer.toAccountID == ctx.accountID &&
            // transfer.tokenID == ctx.poolTokenID &&
            // transfer.feeTokenID == 0 &&
            // transfer.fee == 0 &&
            packedData & 0xffff00000000ffffffffffff000000ffffffff00000000 ==
            (uint(ExchangeData.TransactionType.TRANSFER) << 176) | (1 << 168) | (uint(ctx.accountID) << 104) | (uint(ctx.poolTokenID) << 88) &&
            // transfer.amount.isAlmostEqualAmount(burnAmount) &&
            (100000 - 8) * burnAmount <= amount * 100000 && amount * 100000 <= (100000 + 8) * burnAmount &&
            to == address(this) &&
            from == _from &&
            (signature.length == 0 || /*storageID*/(packedData & 0xffffffff) == burnStorageID),
            "INVALID_BURN_TX_DATA"
        );

        // Update pool balance
        ctx.totalSupply = ctx.totalSupply.sub(uint96(amount));
    }

    function _calculateExitAmounts(
        AmmData.Context  memory ctx,
        AmmData.PoolExit memory exit
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
        uint ratio = uint(AmmData.POOL_TOKEN_BASE).mul(exit.burnAmount) / ctx.totalSupply;

        for (uint i = 0; i < ctx.tokens.length; i++) {
            uint96 amount = (ratio.mul(ctx.tokenBalancesL2[i]) / AmmData.POOL_TOKEN_BASE).toUint96();
            if (amount < exit.exitMinAmounts[i]) {
                return (false, amounts);
            }
            amounts[i] = amount;
        }

        return (true, amounts);
    }
}
