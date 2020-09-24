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
    using ERC20SafeTransfer for address;
    using MathUint          for uint;
    using MathUint96        for uint96;
    using SafeCast          for uint;
    using TransactionReader for ExchangeData.Block;

    function processDeposit(
        AmmData.State    storage S,
        AmmData.Context  memory  ctx,
        AmmData.Token    memory  token,
        uint96                   amount
        )
        public
    {
        // Check that the deposit in the block matches the expected deposit
        DepositTransaction.Deposit memory _deposit = ctx._block.readDeposit(ctx.txIdx++);
        require(_deposit.owner == address(this), "INVALID_TX_DATA");
        require(_deposit.accountID == S.accountID, "INVALID_TX_DATA");
        require(_deposit.tokenID == token.tokenID, "INVALID_TX_DATA");
        require(_deposit.amount == amount, "INVALID_TX_DATA");

        // Now do this deposit
        uint ethValue = 0;
        if (token.addr == address(0)) {
            ethValue = amount;
        } else {
            address depositContract = address(S.exchange.getDepositContract());
            uint allowance = ERC20(token.addr).allowance(address(this), depositContract);
            if (allowance < amount) {
                // Approve the deposit transfer
                ERC20(token.addr).approve(depositContract, uint(-1));
            }
        }

        S.exchange.deposit{value: ethValue}(
            _deposit.owner,
            _deposit.owner,
            token.addr,
            uint96(_deposit.amount),
            new bytes(0)
        );
        ctx.numTransactionsConsumed++;
        // Total balance in this contract decreases by the amount deposited
        S.totalLockedBalance[token.addr] = S.totalLockedBalance[token.addr].sub(amount);
    }

    function processJoin(
        AmmData.State    storage S,
        AmmData.Context  memory  ctx,
        AmmData.PoolJoin memory  join,
        bytes            memory  signature
        )
        internal
    {
        S.authenticatePoolTx(
            join.owner,
            AmmUtil.hashPoolJoin(ctx.domainSeperator, join),
            signature
        );

        // Check if the requirements are fulfilled
        (bool valid, uint poolAmountOut, uint96[] memory amounts) = validateJoinAmounts(ctx, join);

        if (!valid) return;

        S.mint(join.owner, poolAmountOut);

        for (uint i = 0; i < ctx.size; i++) {
            uint96 amount = amounts[i];
            if (join.fromLayer2) {
                TransferTransaction.Transfer memory transfer = ctx._block.readTransfer(ctx.txIdx++);
                require(transfer.from == join.owner, "INVALID_TX_DATA");
                require(transfer.toAccountID == S.accountID, "INVALID_TX_DATA");
                require(transfer.tokenID == ctx.tokens[i].tokenID, "INVALID_TX_DATA");
                require(AmmUtil.isAlmostEqual(transfer.amount, amount), "INVALID_TX_DATA");
                require(transfer.fee == 0, "INVALID_TX_DATA");

                // Replay protection (only necessary when using a signature)
                if (signature.length > 0) {
                    require(transfer.storageID == join.storageIDs[i], "INVALID_TX_DATA");
                }

                // Now approve this transfer
                transfer.validUntil = 0xffffffff;
                bytes32 txHash = TransferTransaction.hashTx(ctx.exchangeDomainSeparator, transfer);
                S.exchange.approveTransaction(join.owner, txHash);

                ctx.numTransactionsConsumed++;
                // Update the amount to the actual amount transferred (which can have some some small rounding errors)
                amount = transfer.amount;
                // Update the balances in the account
                // Q: 为什么更新这个呢？
                ctx.ammActualL2Balances[i] = ctx.ammActualL2Balances[i].add(amount);
            } else {
                // Make the amount unavailable for withdrawing
                address token = ctx.tokens[i].addr;
                S.lockedBalance[token][join.owner] = S.lockedBalance[token][join.owner].sub(amount);
            }
            ctx.ammExpectedL2Balances[i] = ctx.ammExpectedL2Balances[i].add(amount);
        }
    }

    function validateJoinAmounts(
        AmmData.Context  memory ctx,
        AmmData.PoolJoin memory join
        )
        private
        view
        returns(
            bool            valid,
            uint            poolAmountOut,
            uint96[] memory amounts
        )
    {
        // Check if we can still use this join
        amounts = new uint96[](ctx.size);
        if (block.timestamp > join.validUntil) {
            return (false, 0, amounts);
        }

        if (ctx.poolTokenTotalSupply == 0) {
            return(true, ctx.poolTokenInitialSupply, join.maxAmountsIn);
        }

        // Calculate the amount of liquidity tokens that should be minted
        bool initialValueSet = false;
        for (uint i = 0; i < ctx.size; i++) {
            if (ctx.ammExpectedL2Balances[i] > 0) {
                uint amountOut = uint(
                    join.maxAmountsIn[i]).mul(ctx.poolTokenTotalSupply) / uint(ctx.ammExpectedL2Balances[i]
                );
                if (!initialValueSet || amountOut < poolAmountOut) {
                    poolAmountOut = amountOut;
                    initialValueSet = true;
                }
            }
        }

        if (poolAmountOut == 0) {
            return (false, 0, amounts);
        }

        // Calculate the amounts to deposit
        uint ratio = poolAmountOut.mul(ctx.poolTokenBase) / ctx.poolTokenTotalSupply;

        for (uint i = 0; i < ctx.size; i++) {
            amounts[i] = (ratio.mul(ctx.ammExpectedL2Balances[i]) / ctx.poolTokenBase).toUint96();
        }

        valid = (poolAmountOut >= join.minPoolAmountOut);
        return (valid, poolAmountOut, amounts);
    }
}
