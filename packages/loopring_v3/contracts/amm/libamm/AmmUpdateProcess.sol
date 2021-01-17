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
        AmmData.State      storage S,
        AmmData.Context    memory  ctx,
        ExchangeData.Block memory  _block
        )
        internal
        view
    {
        for (uint i = 0; i < ctx.tokens.length; i++) {
            // Check that the AMM update in the block matches the expected update
            AmmUpdateTransaction.AmmUpdate memory update = _block.readAmmUpdate(ctx.txIdx++);

            require(
                update.owner == address(this) &&
                update.accountID == ctx.accountID &&
                update.tokenID == ctx.tokens[i].tokenID &&
                update.feeBips == S.feeBips &&
                update.tokenWeight == ctx.tokens[i].weight,
                "INVALID_AMM_UPDATE_TX_DATA"
            );

            ctx.tokenBalancesL2[i] = update.balance;
        }
    }
}
