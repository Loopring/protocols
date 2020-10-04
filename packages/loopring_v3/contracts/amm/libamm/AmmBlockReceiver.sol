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

    function beforeBlockSubmission(
        AmmData.State      storage S,
        bytes              memory  context,
        ExchangeData.Block memory  _block,
        bytes              memory  poolTxData,
        uint                       txIdx
        )
        internal
        returns (uint numTxConsumed, bytes memory newContext)
    {
        AmmData.Context memory ctx = context.length == 0 ?
            _getContext(S, txIdx) :
            abi.decode(context, (AmmData.Context));

        if (poolTxData.length == 0) {
            // Check header only once per block per receiver
            BlockReader.BlockHeader memory header = _block.readHeader();
            require(header.exchange == address(ctx.exchange), "INVALID_EXCHANGE");

            // This marks end of all pool transactions for this block.
            S.poolTokenBurnedSupply = ctx.poolTokenBurnedSupply;
            return (0, new bytes(0));
        }

        S.approveAmmUpdates(_block, ctx, true);

        _processPoolTx(S, _block, ctx, poolTxData);

        S.approveAmmUpdates(_block, ctx, false);

        numTxConsumed = ctx.txIdx - txIdx;
        newContext = abi.encode(ctx);
    }

    function _getContext(
        AmmData.State      storage S,
        uint                       txIdx
        )
        private
        view
        returns (AmmData.Context memory)
    {
        return AmmData.Context({
            txIdx: txIdx,
            exchange: S.exchange,
            exchangeDomainSeparator: S.exchange.getDomainSeparator(),
            domainSeparator: S.domainSeparator,
            accountID: S.accountID,
            poolTokenID: S.poolTokenID,
            poolTokenBurnedSupply: S.poolTokenBurnedSupply,
            tokens: S.tokens,
            tokenBalancesL2: new uint96[](S.tokens.length)
        });
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
