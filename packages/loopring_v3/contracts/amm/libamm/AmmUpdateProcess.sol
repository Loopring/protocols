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
        AmmData.Context    memory  ctx,
        bytes              memory  txsData
        )
        internal
        view
    {
        AmmUpdateTransaction.AmmUpdate memory update;
        for (uint i = 0; i < ctx.tokens.length; i++) {
            // Check that the AMM update in the block matches the expected update
            AmmUpdateTransaction.readTx(txsData, ctx.txIdx++ * ExchangeData.TX_DATA_AVAILABILITY_SIZE + 1, update);

            require(
                update.owner == address(this) &&
                update.accountID == ctx.accountID &&
                update.tokenID == ctx.tokens[i].tokenID &&
                update.feeBips == ctx.feeBips &&
                update.tokenWeight == ctx.tokens[i].weight,
                "INVALID_AMM_UPDATE_TX_DATA"
            );

            ctx.tokenBalancesL2[i] = update.balance;
        }
    }
}
