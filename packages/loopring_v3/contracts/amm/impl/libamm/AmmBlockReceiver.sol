// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "./AmmUpdateProcess.sol";
import "./AmmJoinProcess.sol";
import "./AmmExitProcess.sol";
import "./AmmData.sol";
import "../../../lib/AddressUtil.sol";
import "../../../lib/ERC20SafeTransfer.sol";
import "../../../lib/SignatureUtil.sol";
import "../../../core/impl/libtransactions/BlockReader.sol";

/// @title AmmBlockReceiver
library AmmBlockReceiver
{
    using BlockReader       for ExchangeData.Block;
    using AmmUpdateProcess  for AmmData.State;
    using AmmJoinProcess    for AmmData.State;
    using AmmExitProcess    for AmmData.State;

    function beforeBlockSubmitted(
        AmmData.State      storage S,
        ExchangeData.Block memory  _block,
        uint                       txIdx,
        bytes              memory  auxiliaryData
        )
        external
        returns (uint)
    {
        AmmData.PoolTransaction[] memory poolTransactions = abi.decode(
            auxiliaryData,
            (AmmData.PoolTransaction[])
        );

        // Cache the domain seperator to save on SLOADs each time it is accessed.
        AmmData.Context memory ctx = AmmData.Context({
            _block: _block,
            txIdx: txIdx,
            domainSeperator: S.domainSeperator,
            exchangeDomainSeparator: S.exchange.getDomainSeparator(),
            ammActualL2Balances: new uint96[](S.tokens.length),
            ammExpectedL2Balances: new uint96[](S.tokens.length),
            numTransactionsConsumed: 0,
            tokens: S.tokens,
            totalSupply: 0, // TODO
            base: 0, // TODO
            initialSupply: 0 // TODO
        });

        BlockReader.BlockHeader memory header = _block.readHeader();
        require(header.exchange == address(S.exchange), "INVALID_EXCHANGE");

        // The starting AMM updates
        // This also pulls the AMM balances onchain.
        S.processAmmUpdates(ctx, true);

        // Process all pool transactions
        for (uint n = 0; n < poolTransactions.length; n++) {
            AmmData.PoolTransaction memory poolTx = poolTransactions[n];
            if (poolTx.txType == AmmData.PoolTransactionType.JOIN) {
                AmmData.PoolJoin memory join = abi.decode(poolTx.data, (AmmData.PoolJoin));
                S.processJoin(ctx, join, poolTx.signature);
            } else if (poolTx.txType == AmmData.PoolTransactionType.EXIT) {
                AmmData.PoolExit memory exit = abi.decode(poolTx.data, (AmmData.PoolExit));
                S.processExit(ctx, exit, poolTx.signature);
            }
        }

        // Deposit/Withdraw to/from the AMM account when necessary
        for (uint i = 0; i < ctx.tokens.length; i++) {
            if (ctx.ammExpectedL2Balances[i] > ctx.ammActualL2Balances[i]) {
                uint96 amount = ctx.ammExpectedL2Balances[i] - ctx.ammActualL2Balances[i];
                S.processDeposit(ctx, ctx.tokens[i], amount);
            } else if (ctx.ammActualL2Balances[i] > ctx.ammExpectedL2Balances[i]) {
                uint96 amount = ctx.ammActualL2Balances[i] - ctx.ammExpectedL2Balances[i];
                S.processWithdrawal(ctx, ctx.tokens[i], amount);
            }
        }

        // The ending AMM updates
        S.processAmmUpdates(ctx, false);

        return ctx.numTransactionsConsumed;
    }

}
