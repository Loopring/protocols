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


/// @title AmmExchange
library AmmExchange
{
    using AmmPoolToken      for AmmData.State;
    using AmmStatus         for AmmData.State;
    using AmmUtil           for uint96;
    using ERC20SafeTransfer for address;
    using MathUint          for uint;
    using MathUint96        for uint96;
    using SafeCast          for uint;
    using TransactionReader for ExchangeData.Block;

    function approveTokenDeposit(
        AmmData.Context  memory  ctx,
        AmmData.Token    memory  token,
        uint96                   amount
        )
        internal
    {
        require(amount > 0, "INVALID_DEPOSIT_AMOUNT");

        DepositTransaction.Deposit memory deposit = ctx._block.readDeposit(ctx.txIdx++);
        ctx.numTransactionsConsumed++;

        require(
            deposit.to == address(this) &&
            deposit.toAccountID== ctx.accountID &&
            deposit.tokenID == token.tokenID &&
            deposit.amount == amount,
            "INVALID_TX_DATA"
        );

        // Now do this deposit
        uint ethValue = 0;
        if (token.addr == address(0)) {
            ethValue = amount;
        } else {
            address exchangeDepositContract = address(ctx.exchange.getDepositContract());
            // TODO(daniel): use try-catch?
            uint allowance = ERC20(token.addr).allowance(address(this), exchangeDepositContract);
            if (allowance < amount) {
                // Approve the deposit transfer
                ERC20(token.addr).approve(exchangeDepositContract, uint(-1));
            }
        }

        ctx.exchange.deposit{value: ethValue}(
            address(this),
            address(this),
            token.addr,
            amount,
            new bytes(0)
        );
    }

    function approveTokenWithdrawal(
        AmmData.Context  memory  ctx,
        AmmData.Token    memory  token,
        uint                     amount
        )
        internal
    {
        // Check that the withdrawal in the block matches the expected withdrawal
        WithdrawTransaction.Withdrawal memory withdrawal = ctx._block.readWithdrawal(ctx.txIdx++);
        ctx.numTransactionsConsumed++;

        // These fields are not read by readWithdrawal: storageID
        withdrawal.minGas = 0;
        withdrawal.to = address(this);
        withdrawal.extraData = new bytes(0);

        require(
            withdrawal.withdrawalType == 1 &&
            withdrawal.from == address(this) &&
            withdrawal.fromAccountID== ctx.accountID &&
            withdrawal.tokenID == token.tokenID &&
            withdrawal.amount == amount && //No rounding errors because we put in the complete uint96 in the DA.
            withdrawal.feeTokenID == 0 &&
            withdrawal.fee == 0 &&
            withdrawal.onchainDataHash == WithdrawTransaction.hashOnchainData(
                withdrawal.minGas,
                withdrawal.to,
                withdrawal.extraData
            ),
            "INVALID_TX_DATA"
        );

        // Now approve this withdrawal
        withdrawal.validUntil = 0xffffffff;
        bytes32 txHash = WithdrawTransaction.hashTx(ctx.exchangeDomainSeparator, withdrawal);
        ctx.exchange.approveTransaction(address(this), txHash);
    }

    // Withdraw any outstanding balances for the pool account on the exchange
    function withdrawFromApprovedWithdrawals(
        AmmData.State storage S,
        bool                  onlyWithdrawPoolToken
        )
        internal
    {
        uint size = onlyWithdrawPoolToken? 1 : S.tokens.length;
        address[] memory owners = new address[](size);
        address[] memory tokens = new address[](size);

        if (onlyWithdrawPoolToken) {
            owners[0] = address(this);
            tokens[0] = address(this);
        } else {
            for (uint i = 0; i < size; i++) {
                owners[i] = address(this);
                tokens[i] = S.tokens[i].addr;
            }
        }
        S.exchange.withdrawFromApprovedWithdrawals(owners, tokens);
    }
}
