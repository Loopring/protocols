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
        uint txsDataPtr = ctx.txsDataPtr + 5;
        for (uint i = 0; i < ctx.tokens.length; i++) {
            // txType | owner | accountID | tokenID | feeBips
            uint packedDataA;
            // tokenWeight | nonce | balance
            uint packedDataB;
            assembly {
                packedDataA := calldataload(txsDataPtr)
                packedDataB := calldataload(add(txsDataPtr, 28))
            }

            AmmData.Token memory token = ctx.tokens[i];

            require(
                packedDataA & 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffff ==
                (uint(ExchangeData.TransactionType.AMM_UPDATE) << 216) | (uint(address(this)) << 56) | (ctx.accountID << 24) | (token.tokenID << 8) | ctx.feeBips &&
                (packedDataB >> 128) & 0xffffffffffffffffffffffff == token.weight,
                "INVALID_AMM_UPDATE_TX_DATA"
            );

            ctx.tokenBalancesL2[i] = uint96(packedDataB & 0xffffffffffffffffffffffff);

            txsDataPtr += ExchangeData.TX_DATA_AVAILABILITY_SIZE;
        }

        ctx.txsDataPtr += ExchangeData.TX_DATA_AVAILABILITY_SIZE * ctx.tokens.length;
    }
}
