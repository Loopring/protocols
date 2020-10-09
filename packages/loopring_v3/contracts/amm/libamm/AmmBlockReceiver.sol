// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../core/impl/libtransactions/BlockReader.sol";
import "../../lib/MathUint.sol";
import "./AmmData.sol";
import "./AmmExitProcess.sol";
import "./AmmJoinProcess.sol";
import "./AmmPoolToken.sol";
import "./AmmUpdateProcess.sol";


/// @title AmmBlockReceiver
library AmmBlockReceiver
{
    using AmmExitProcess    for AmmData.State;
    using AmmJoinProcess    for AmmData.State;
    using AmmPoolToken      for AmmData.State;
    using AmmUpdateProcess  for AmmData.State;
    using BlockReader       for ExchangeData.Block;

    function beforeAllBlocks(AmmData.State storage S)
        internal
        view
        returns (AmmData.Context memory)
    {
        uint size = S.tokens.length;
        return AmmData.Context({
            txIdx: 0,
            exchange: S.exchange,
            exchangeDomainSeparator: S.exchange.getDomainSeparator(),
            domainSeparator: S.domainSeparator,
            accountID: S.accountID,
            poolTokenID: S.poolTokenID,
            tokens: S.tokens,
            tokenBalancesL2: new uint96[](size),
            totalSupply: S._totalSupply,
            pendingTxIdx: 0,
            pendingTxOwners: new address[](size * 3),
            pendingTxHashes: new bytes32[](size * 3)
        });
    }

    function afterAllBlocks(
        AmmData.State   storage S,
        AmmData.Context memory  ctx
        )
        internal
    {
        S._totalSupply = ctx.totalSupply;
        S.exchange.approveTransactions(ctx.pendingTxOwners, ctx.pendingTxHashes);
    }

    function beforeEachBlock(
        AmmData.State      storage /* S */,
        ExchangeData.Block memory  _block,
        AmmData.Context    memory  ctx
        )
        internal
        pure
    {
        BlockReader.BlockHeader memory header = _block.readHeader();
        require(header.exchange == address(ctx.exchange), "INVALID_EXCHANGE");
    }

    function onAmmTransaction(
        AmmData.State      storage S,
        AmmData.Context    memory  ctx,
        ExchangeData.Block memory  _block,
        bytes              memory  poolTxData,
        uint                       txIdx
        )
        internal
        returns (uint)
    {
        ctx.txIdx = txIdx;

        S.approveAmmUpdates(_block, ctx);
        _processPoolTx(S, _block, ctx, poolTxData);

        return ctx.txIdx - txIdx;
    }

    function _processPoolTx(
        AmmData.State      storage S,
        ExchangeData.Block memory  _block,
        AmmData.Context    memory  ctx,
        bytes              memory  poolTxData
        )
        private
    {
        AmmData.PoolTx memory poolTx = abi.decode(poolTxData, (AmmData.PoolTx));
        if (poolTx.txType == AmmData.PoolTxType.JOIN) {
            S.processJoin(
                _block,
                ctx,
                abi.decode(poolTx.data, (AmmData.PoolJoin)),
                poolTx.signature
            );
        } else if (poolTx.txType == AmmData.PoolTxType.EXIT) {
            S.processExit(
                _block,
                ctx,
                abi.decode(poolTx.data, (AmmData.PoolExit)),
                poolTx.signature
            );
        } else {
            revert("INVALID_POOL_TX_TYPE");
        }
    }
}
