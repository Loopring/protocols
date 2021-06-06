// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../lib/ERC20.sol";
import "../../lib/MathUint96.sol";
import "../../lib/TransferUtil.sol";
import "./AmmAssetManagement.sol";
import "./AmmData.sol";
import "./AmmPoolToken.sol";
import "./AmmStatus.sol";
import "./AmmUtil.sol";
import "./AmmWithdrawal.sol";


/// @title AmmDepositProcess
library AmmDepositProcess
{
    using AmmAssetManagement for AmmData.State;
    using MathUint96         for uint96;
    using TransferUtil       for address;

    function processDeposit(
        AmmData.State       storage S,
        AmmData.Context     memory ctx,
        AmmData.PoolDeposit memory poolDeposit
        )
        internal
    {
        require(poolDeposit.amounts.length == ctx.tokens.length, "INVALID_DEPOSIT_DATA");
        for (uint i = 0; i < ctx.tokens.length; i++) {
            uint96 amount = poolDeposit.amounts[i];
            if (amount > 0) {
                address token = ctx.tokens[i].addr;
                verifyDepositTx(ctx, ctx.tokens[i].tokenID, amount);
                S.deposit(token, amount);
                S.balancesL1[token] = S.balancesL1[token].sub(amount);
            }
        }
    }

    function verifyDepositTx(
        AmmData.Context memory ctx,
        uint                   tokenID,
        uint96                 amount
        )
        internal
        view
    {
        // Verify deposit data
        // Start by reading the first 27 bytes into packedData
        uint txsDataPtr = ctx.txsDataPtr + 27;
        // packedData: txType (1) | owner (20) | accountID (4) | tokenID (2)
        uint packedData;
        uint96 txAmount;
        assembly {
            packedData := calldataload(txsDataPtr)
            txAmount := calldataload(add(txsDataPtr, 12))
        }

        require(
            // txType == ExchangeData.TransactionType.DEPOSIT &&
            // owner == address(this) &&
            // accountID == ctx.accountID &&
            // tokenID == tokenID &&
            packedData & 0xffffffffffffffffffffffffffffffffffffffffffffffffffffff == (uint(ExchangeData.TransactionType.DEPOSIT) << 208) |
            (uint(address(this)) << 48) |
            (uint(ctx.accountID) << 16) |
            uint(tokenID) && amount == txAmount,
            "INVALID_AMM_DEPOSIT_TX_DATA"
        );

        ctx.txsDataPtr += ExchangeData.TX_DATA_AVAILABILITY_SIZE;
    }
}