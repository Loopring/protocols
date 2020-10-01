// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../core/impl/libtransactions/BlockReader.sol";
import "../../lib/MathUint.sol";
import "./AmmData.sol";
import "./AmmExchange.sol";
import "./AmmExitProcess.sol";
import "./AmmJoinProcess.sol";
import "./AmmPoolToken.sol";
import "./AmmUpdateProcess.sol";


/// @title AmmBlockReceiver
library AmmBlockReceiver
{
    using AmmExchange       for AmmData.State;
    using AmmExitProcess    for AmmData.State;
    using AmmJoinProcess    for AmmData.State;
    using AmmPoolToken      for AmmData.State;
    using AmmUpdateProcess  for AmmData.State;
    using BlockReader       for ExchangeData.Block;
    using MathUint          for uint;

    function beforeBlockSubmission(
        AmmData.State      storage S,
        ExchangeData.Block memory  _block,
        bytes              memory  poolTxData,
        uint                       txIdx
        )
        public
        returns (uint)
    {
        AmmData.Context memory ctx = getContext(S, _block, txIdx);

        // Question(brecht): is it OK not to check the following for every poolTx?

        BlockReader.BlockHeader memory header = _block.readHeader();
        require(header.exchange == address(ctx.exchange), "INVALID_EXCHANGE");

        // The openning AMM updates will pull the latest AMM layer2 balances onchain.
        S.approveAmmUpdates(ctx, true);

        processPoolTx(S, ctx, poolTxData);

        appproveDepositOrWithdrawal(ctx);

        S.approveAmmUpdates(ctx, false);

        return ctx.numTransactionsConsumed;
    }

    function afterAllBlocksSubmitted(
        AmmData.State        storage S,
        ExchangeData.Block[] memory
        )
        public
    {
        S.withdrawFromApprovedWithdrawals(true);

        uint poolSupplyToBurn = S.poolSupplyToBurn;
        if (poolSupplyToBurn > 0) {
            S.burn(address(this), poolSupplyToBurn);
            S.poolSupplyToBurn = 0;
        }
    }

    function getContext(
        AmmData.State      storage S,
        ExchangeData.Block memory  _block,
        uint                       txIdx
        )
        private
        view
        returns (AmmData.Context memory)
    {
        uint size = S.tokens.length - 1;
        return AmmData.Context({
            _block: _block,
            txIdx: txIdx,
            exchange: S.exchange,
            exchangeDomainSeparator: S.exchange.getDomainSeparator(),
            domainSeparator: S.domainSeparator,
            accountID: S.accountID,
            tokens: S.tokens,
            poolTokenBase: AmmData.LP_TOKEN_BASE(),
            poolTokenInitialSupply: AmmData.LP_TOKEN_INITIAL_SUPPLY(),
            size: size,
            ammActualL2Balances: new uint96[](size),
            ammExpectedL2Balances: new uint96[](size),
            numTransactionsConsumed: 0,
            totalSupply: S.totalSupply_()
        });
    }
    function processPoolTx(
        AmmData.State           storage S,
        AmmData.Context         memory  ctx,
        bytes                   memory  poolTxData
        )
        private
    {
        AmmData.PoolTx memory poolTx = abi.decode(poolTxData, (AmmData.PoolTx));
        if (poolTx.txType == AmmData.PoolTxType.JOIN) {
            S.processJoin(
                ctx,
                abi.decode(poolTx.data, (AmmData.PoolJoin)),
                poolTx.signature
            );
        } else if (poolTx.txType == AmmData.PoolTxType.EXIT) {
            S.processExit(
                ctx,
                abi.decode(poolTx.data, (AmmData.PoolExit)),
                poolTx.signature
            );
        } else {
            revert("INVALID_POOL_TX_TYPE");
        }
    }

    function appproveDepositOrWithdrawal(
        AmmData.Context memory ctx
        )
        private
    {
        for (uint i = 0; i < ctx.size; i++) {
            uint96 expected = ctx.ammExpectedL2Balances[i];
            uint96 actual = ctx.ammActualL2Balances[i];

            if (expected > actual) {
                AmmExchange.approveTokenDeposit(ctx, ctx.tokens[i], expected - actual);
            } else if (expected < actual) {
                AmmExchange.approveTokenWithdrawal(ctx, ctx.tokens[i], actual - expected);
            }
        }
    }
}
