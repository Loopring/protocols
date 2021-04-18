// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../aux/transactions/TransactionReader.sol";
import "../../core/impl/libtransactions/AmmUpdateTransaction.sol";
import "./AmmData.sol";
import "./AmmUtil.sol";


/// @title AmmUpdateProcess
library AmmUpdateProcess
{
    using TransactionReader for ExchangeData.Block;

    function approveAmmUpdates(
        AmmData.Context    memory   ctx
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
                (uint(ExchangeData.TransactionType.AMM_UPDATE) << 216) | (uint(address(this)) << 56) | (ctx.accountID << 24) | (token.tokenID << 8) | ctx.feeBips &&
                // update.tokenWeight == token.weight
                (packedDataB >> 128) & 0xffffffffffffffffffffffff == token.weight,
                "INVALID_AMM_UPDATE_TX_DATA"
            );

            ctx.tokenBalancesL2[i] = /*tokenWeight*/uint96(packedDataB & 0xffffffffffffffffffffffff);

            txsDataPtr += ExchangeData.TX_DATA_AVAILABILITY_SIZE;
        }

        ctx.txsDataPtr += ExchangeData.TX_DATA_AVAILABILITY_SIZE * ctx.tokens.length;
    }
}
