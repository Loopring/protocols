// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../aux/transactions/TransactionReader.sol";
import "../../core/impl/libtransactions/AmmUpdateTransaction.sol";
import "./AmmData.sol";
import "./AmmUtil.sol";
import "../../lib/MathUint96.sol";


/// @title AmmUpdateProcess
library AmmUpdateProcess
{
    using MathUint96        for uint96;
    using TransactionReader for ExchangeData.Block;

    function approveAmmUpdates(
        AmmData.State      storage S,
        AmmData.Context    memory  ctx,
        bool                       start
        )
        internal
        view
    {
        // Start by reading the first 28 bytes into packedData
        uint txsDataPtr = ctx.txsDataPtr + 28;
        for (uint i = 0; i < ctx.tokens.length; i++) {
            AmmData.Token memory token = ctx.tokens[i];

            /*
            AmmUpdateTransaction.readTx(txsData, ctx.txIdx++ * ExchangeData.TX_DATA_AVAILABILITY_SIZE, update);

            require(
                update.owner == address(this) &&
                update.accountID == ctx.accountID &&
                update.tokenID == token.tokenID &&
                update.feeBips == ctx.feeBips &&
                update.tokenWeight == token.weight,
                "INVALID_AMM_UPDATE_TX_DATA"
            );
            */

            // txType (1) | owner (20) | accountID (4) | tokenID (2) | feeBips (1)
            uint packedDataA;
            // tokenWeight (12) | nonce (4) | balance (12)
            uint packedDataB;
            assembly {
                packedDataA := calldataload(txsDataPtr)
                packedDataB := calldataload(add(txsDataPtr, 28))
            }

            require(
                // txType == ExchangeData.TransactionType.AMM_UPDATE &&
                // update.owner == address(this)
                // update.accountID == ctx.accountID &&
                // update.tokenID == token.tokenID &&
                // update.feeBips == ctx.feeBips &&
                packedDataA & 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffff ==
                (uint(ExchangeData.TransactionType.AMM_UPDATE) << 216) | (uint(address(this)) << 56) | (ctx.accountID << 24) | (token.tokenID << 8) | ctx.feeBips,
                "INVALID_AMM_UPDATE_TX_DATA"
            );

            if (start) {
                // Bring actual balances and virtual balances from L2 to L1
                ctx.tokenBalancesL2[i] = /*balance*/uint96(packedDataB & 0xffffffffffffffffffffffff);
                ctx.vTokenBalancesL2[i] = /*vbalance*/uint96((packedDataB >> 128) & 0xffffffffffffffffffffffff);
                require(ctx.vTokenBalancesL2[i] > 0, "ZERO_VIRTUAL_BALANCE");
            } else {
                // Verify new virtual balances are the same value as on L2.
                require(
                    ctx.vTokenBalancesL2[i] > 0 &&
                    ctx.vTokenBalancesL2[i] == /*vbalance*/uint96((packedDataB >> 128) & 0xffffffffffffffffffffffff),
                    "INVALID_VIRTUAL_BALANCE_UPDATE"
                );
            }

            txsDataPtr += ExchangeData.TX_DATA_AVAILABILITY_SIZE;
        }

        if (start && ctx.assetManager != IAssetManager(0)) {
            // Add the L1 balances on top of the balances on L2
            for (uint i = 0; i < ctx.tokens.length; i++) {
                ctx.tokenBalancesL2[i] = ctx.tokenBalancesL2[i].add(S.balancesL1[ctx.tokens[i].addr]);
            }
        }

        ctx.txsDataPtr += ExchangeData.TX_DATA_AVAILABILITY_SIZE * ctx.tokens.length;
    }
}
