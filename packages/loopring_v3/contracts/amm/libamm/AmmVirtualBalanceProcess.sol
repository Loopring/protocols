// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../aux/transactions/TransactionReader.sol";
import "./AmmData.sol";
import "./AmmUtil.sol";


/// @title AmmVirtualBalanceProcess
library AmmVirtualBalanceProcess
{
    using TransactionReader for ExchangeData.Block;

    function processSetVirtualBalances(
        AmmData.State               storage S,
        AmmData.Context             memory  ctx,
        AmmData.PoolVirtualBalances memory  poolVirtualBalances
        )
        internal
    {
        require(poolVirtualBalances.vBalancesNew.length == ctx.tokens.length, "INVALID_DATA");
        require(
            ctx.settings.controller.authorizeVirtualBalances(
                ctx.tokenBalancesL2,
                ctx.vTokenBalancesL2,
                poolVirtualBalances.vBalancesNew,
                poolVirtualBalances.data
            ),
            "NEW_VIRTUAL_BALANCES_NOT_AUTHORIZED"
        );
        ctx.vTokenBalancesL2 = poolVirtualBalances.vBalancesNew;
    }
}
