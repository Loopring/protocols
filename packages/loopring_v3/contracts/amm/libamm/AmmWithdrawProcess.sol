// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../lib/ERC20.sol";
import "../../lib/MathUint96.sol";
import "../../lib/TransferUtil.sol";
import "./AmmData.sol";
import "./AmmPoolToken.sol";
import "./AmmStatus.sol";
import "./AmmUtil.sol";


/// @title AmmWithdrawProcess
library AmmWithdrawProcess
{
    using MathUint96        for uint96;
    using TransferUtil      for address;

    function processWithdrawal(
        AmmData.State          storage S,
        AmmData.Context        memory ctx,
        AmmData.PoolWithdrawal memory poolWithdrawal
        )
        internal
    {
        require(ctx.settings.assetManager != IAssetManager(0), "CANNOT_WITHDRAW_FROM_POOL");
        require(poolWithdrawal.amounts.length == ctx.tokens.length, "INVALID_WITHDRAWAL_AMOUNTS");
        for (uint i = 0; i < ctx.tokens.length; i++) {
            uint96 amount = poolWithdrawal.amounts[i];
            if (amount > 0) {
                address token = ctx.tokens[i].addr;
                verifyWithdrawalTx(ctx, ctx.tokens[i].tokenID, amount);
                S.balancesL1[token] = S.balancesL1[token].add(amount);
            }
        }
    }

    function verifyWithdrawalTx(
        AmmData.Context memory ctx,
        uint                   tokenID,
        uint96                 amount
        )
        internal
        view
    {
        if (amount == 0) {
            return;
        }

        bytes20 onchainDataHash = WithdrawTransaction.hashOnchainData(
            0,                  // Withdrawal needs to succeed no matter the gas coast
            address(this),      // Withdraw to this contract first
            new bytes(0)
        );

        // Verify withdrawal data
        // Start by reading the first 2 bytes into header
        uint txsDataPtr = ctx.txsDataPtr + 2;
        // header: txType (1) | type (1)
        uint header;
        // packedData: tokenID (2) | amount (12) | feeTokenID (2) | fee (2)
        uint packedData;
        bytes20 dataHash;
        assembly {
            header     := calldataload(    txsDataPtr     )
            packedData := calldataload(add(txsDataPtr, 42))
            dataHash   := and(calldataload(add(txsDataPtr, 78)), 0xffffffffffffffffffffffffffffffffffffffff000000000000000000000000)
        }

        require(
            // txType == ExchangeData.TransactionType.WITHDRAWAL &&
            // withdrawal.type == 1 &&
            header & 0xffff == (uint(ExchangeData.TransactionType.WITHDRAWAL) << 8) | 1 &&
            // withdrawal.tokenID == token.tokenID &&
            // withdrawal.amount == token.amount &&
            // withdrawal.fee == 0,
            packedData & 0xffffffffffffffffffffffffffff0000ffff == (uint(tokenID) << 128) | (uint(amount) << 32) &&
            onchainDataHash == dataHash,
            "INVALID_AMM_WITHDRAWAL_TX_DATA"
        );

        ctx.txsDataPtr += ExchangeData.TX_DATA_AVAILABILITY_SIZE;
    }
}