// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../aux/transactions/TransactionReader.sol";
import "../../core/impl/libtransactions/AmmUpdateTransaction.sol";
import "../../lib/EIP712.sol";
import "../../lib/ERC20SafeTransfer.sol";
import "../../lib/MathUint.sol";
import "../../lib/MathUint96.sol";
import "../../thirdparty/SafeCast.sol";
import "./AmmData.sol";
import "./AmmJoinRequest.sol";
import "./AmmUtil.sol";


/// @title AmmUpdateProcess
library AmmUpdateProcess
{
    using AmmUtil           for AmmData.State;
    using ERC20SafeTransfer for address;
    using MathUint          for uint;
    using MathUint96        for uint96;
    using SafeCast          for uint;
    using TransactionReader for ExchangeData.Block;

    function processAmmUpdates(
        AmmData.State    storage S,
        AmmData.Context  memory  ctx,
        bool                     opening
        )
        internal
    {
        for (uint i = 0; i < ctx.size; i++) {
            // Check that the AMM update in the block matches the expected update
            AmmUpdateTransaction.AmmUpdate memory update = ctx._block.readAmmUpdate(ctx.txIdx++);

            require(update.owner == address(this), "INVALID_TX_DATA");
            require(update.accountID == S.accountID, "INVALID_TX_DATA");
            require(update.tokenID == ctx.tokens[i].tokenID, "INVALID_TX_DATA");
            require(update.feeBips == S.feeBips, "INVALID_TX_DATA");
            require(update.tokenWeight == (opening ? 0 : ctx.tokens[i].weight), "INVALID_TX_DATA");

            // Now approve this AMM update
            update.validUntil = 0xffffffff;
            bytes32 txHash = AmmUpdateTransaction.hashTx(ctx.exchangeDomainSeparator, update);
            S.exchange.approveTransaction(address(this), txHash);

            ctx.numTransactionsConsumed++;

            if (opening) {
                // AMM account balance now available onchain
                ctx.ammActualL2Balances[i]   = update.balance;
                ctx.ammExpectedL2Balances[i] = update.balance;
            } else {
                require(ctx.ammExpectedL2Balances[i] == update.balance, "UNEXPECTED_AMM_BALANCE");
            }
        }
    }
}
