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

    function proxcessExchangeDeposit(
        AmmData.State    storage S,
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
            deposit.accountID == S.accountID &&
            deposit.tokenID == token.tokenID &&
            deposit.amount == amount,
            "INVALID_TX_DATA"
        );

        // Now do this deposit
        uint ethValue = 0;
        if (token.addr == address(0)) {
            ethValue = amount;
        } else {
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

        // Total balance in this contract decreases by the amount deposited
        S.totalUserBalance[token.addr] = S.totalUserBalance[token.addr].sub(amount);
    }

    function processJoin(
        AmmData.State    storage S,
        AmmData.Context  memory  ctx,
        AmmData.PoolJoin memory  join,
        bytes            memory  signature
        )
        internal
    {
        S.validatePoolTransaction(
            join.owner,
            AmmJoinRequest.hashPoolJoin(ctx.domainSeparator, join),
            signature
        );

        // Check if the requirements are fulfilled
        (bool slippageRequirementMet, uint poolAmountOut, uint96[] memory amounts) = _calculateJoinAmounts(S, ctx, join);

        if (!slippageRequirementMet) return;

        for (uint i = 0; i < ctx.size; i++) {
            uint96 amount = amounts[i];

            if (join.fromLayer2) {
                TransferTransaction.Transfer memory transfer = ctx._block.readTransfer(ctx.txIdx++);
                ctx.numTransactionsConsumed++;

                // We do not check these fields: fromAccountID, to, amount, fee, storageID
                require(
                    transfer.toAccountID == S.accountID &&
                    transfer.from == join.owner &&
                    transfer.tokenID == ctx.tokens[i].tokenID &&
                    transfer.amount.isAlmostEqual(amount) &&
                    transfer.feeTokenID == ctx.tokens[i].tokenID &&
                    transfer.fee.isAlmostEqual(join.fees[i]),
                    "INVALID_TX_DATA"
                );

                // Replay protection when using a signature (otherwise the approved hash is cleared onchain)
                if (signature.length > 0) {
                    require(transfer.storageID == join.storageIDs[i], "INVALID_TX_DATA");
                }

                // Now approve this transfer
                transfer.validUntil = 0xffffffff;
                bytes32 txHash = TransferTransaction.hashTx(ctx.exchangeDomainSeparator, transfer);
                ctx.exchange.approveTransaction(join.owner, txHash);

                ctx.ammActualL2Balances[i] = ctx.ammActualL2Balances[i].add(amount);

            } else {
                // Make the amount unavailable for withdrawing
                address token = ctx.tokens[i].addr;
                S.userBalance[token][join.owner] = S.userBalance[token][join.owner].sub(amount);
            }

            ctx.ammExpectedL2Balances[i] = ctx.ammExpectedL2Balances[i].add(amount);
        }

        S.mint(address(this), poolAmountOut);
        S.addUserBalance(address(this), join.owner, poolAmountOut);
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
        amounts = new uint96[](ctx.size);
        uint _totalSupply = S.totalSupply;

        if (block.timestamp > join.validUntil) {
            return (false, 0, amounts);
        }

        if (_totalSupply == 0) {
            return(true, ctx.poolTokenInitialSupply, join.maxAmountsIn);
        }

        // Calculate the amount of liquidity tokens that should be minted
        for (uint i = 0; i < ctx.size; i++) {
            if (ctx.ammExpectedL2Balances[i] > 0) {
                uint amountOut = uint(join.maxAmountsIn[i])
                    .mul(_totalSupply) / uint(ctx.ammExpectedL2Balances[i]);

                if (amountOut < poolAmountOut) {
                    poolAmountOut = amountOut;
                }
            }
        }

        if (poolAmountOut == 0) {
            return (false, 0, amounts);
        }

        // Calculate the amounts to deposit
        uint ratio = poolAmountOut.mul(ctx.poolTokenBase) / _totalSupply;

        for (uint i = 0; i < ctx.size; i++) {
            amounts[i] = ratio.mul(ctx.ammExpectedL2Balances[i] / ctx.poolTokenBase).toUint96();
        }

        slippageRequirementMet = (poolAmountOut >= join.minPoolAmountOut);
        return (slippageRequirementMet, poolAmountOut, amounts);
    }
}
