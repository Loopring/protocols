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

    event ExitProcessed(address owner, uint96 burnAmount, uint96[] amounts, bool forced);

    function processExit(
        AmmData.State    storage S,
        AmmData.Context  memory  ctx,
        AmmData.PoolExit memory  exit,
        bytes            memory  signature
        )
        internal
    {
        bytes32 txHash = AmmExitRequest.hash(ctx.domainSeparator, exit);
        bool isForcedExit = false;

        if (signature.length == 0) {
            AmmData.PoolExit storage forceExit = S.forcedExit[txHash];
            require(
                forceExit.validUntil > 0 && forceExit.validUntil <= block.timestamp,
                "FORCED_EXIT_NOT_FOUND"
            );

            delete S.forcedExit[txHash];
            delete S.isExiting[exit.owner];
            S.forcedExitCount--;
            isForcedExit = true;
        } else {
            require(txHash.verifySignature(exit.owner, signature), "INVALID_EXIT_APPROVAL");
        }

        (bool slippageOK, uint96[] memory amounts) = _calculateExitAmounts(ctx, exit);

        if (isForcedExit) {
            if (!slippageOK) {
                emit ExitProcessed(exit.owner, 0, new uint96[](0), isForcedExit);
                return;
            }
            S.burn(address(this), exit.burnAmount);
            ctx.totalSupply = ctx.totalSupply.sub(exit.burnAmount);
            assert(ctx.totalSupply == S.totalSupply);
        } else {
            require(slippageOK, "EXIT_SLIPPAGE_INVALID");
            _burnL2(ctx, exit.burnAmount, exit.owner, exit.burnStorageID);
        }

        // Handle liquidity tokens
        for (uint i = 0; i < ctx.size; i++) {
            TransferTransaction.Transfer memory transfer = ctx._block.readTransfer(ctx.txIdx++);

            require(
                transfer.fromAccountID== ctx.accountID &&
                // transfer.toAccountID == UNKNOWN &&
                // transfer.storageID == UNKNOWN &&
                transfer.from == address(this) &&
                transfer.to == exit.owner &&
                transfer.tokenID == ctx.tokens[i].tokenID &&
                transfer.amount.isAlmostEqual(amounts[i]) &&
                transfer.feeTokenID == 0 &&
                transfer.fee == 0,
                "INVALID_TX_DATA"
            );

            transfer.validUntil = 0xffffffff;
            bytes32 hash = TransferTransaction.hashTx(ctx.exchangeDomainSeparator, transfer);
            ctx.exchange.approveTransaction(address(this), hash);

            ctx.layer2Balances[i] = ctx.layer2Balances[i].sub(transfer.amount);
        }

        emit ExitProcessed(exit.owner, exit.burnAmount, amounts, isForcedExit);
    }

    function _burnL2(
        AmmData.Context  memory  ctx,
        uint96                   amount,
        address                  from,
        uint32                   burnStorageID
        )
        internal
    {
        TransferTransaction.Transfer memory transfer = ctx._block.readTransfer(ctx.txIdx++);

        require(
            // transfer.fromAccountID == UNKNOWN &&
            transfer.toAccountID == ctx.accountID &&
            transfer.from == from &&
            transfer.to == address(this) &&
            transfer.tokenID == ctx.poolTokenID &&
            transfer.amount.isAlmostEqual(amount) &&
            transfer.feeTokenID == 0 &&
            transfer.fee == 0 &&
            transfer.storageID == burnStorageID,
            "INVALID_TX_DATA"
        );

        transfer.validUntil = 0xffffffff;
        bytes32 hash = TransferTransaction.hashTx(ctx.exchangeDomainSeparator, transfer);
        ctx.exchange.approveTransaction(address(this), hash);

        // Update pool balance
        ctx.poolBalanceL2 = ctx.poolBalanceL2.add(transfer.amount);
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
        uint ratio = ctx.poolTokenBase.mul(exit.burnAmount) / ctx.effectiveTotalSupply();

        for (uint i = 0; i < ctx.size; i++) {
            amounts[i] = (ratio.mul(ctx.layer2Balances[i]) / ctx.poolTokenBase).toUint96();
            if (amounts[i] < exit.exitMinAmounts[i]) {
                return (false, amounts);
            }
        }

        return (true, amounts);
    }
}
