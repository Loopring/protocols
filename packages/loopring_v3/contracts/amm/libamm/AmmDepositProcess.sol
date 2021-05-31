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
            verifyDepositTx(ctx, ctx.tokens[i].tokenID, poolDeposit.amounts[i]);
            S.deposit(ctx.tokens[i].addr, poolDeposit.amounts[i]);
            S.balancesL1[ctx.tokens[i].addr] = S.balancesL1[ctx.tokens[i].addr].sub(poolDeposit.amounts[i]);
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
        if (amount == 0) {
            return;
        }

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
            // accountID == crx.accountID &&
            // tokenID == tokenID &&
            packedData & 0xffffffffffffffffffffffffffffffffffffffffffffffffffffff == (uint(ExchangeData.TransactionType.DEPOSIT) << 208) | (uint(address(this)) << 48) | (uint(ctx.accountID) << 16) | uint(tokenID) &&
            amount == txAmount,
            "INVALID_DEPOSIT_TX_DATA"
        );

        ctx.txsDataPtr += ExchangeData.TX_DATA_AVAILABILITY_SIZE;
    }
}