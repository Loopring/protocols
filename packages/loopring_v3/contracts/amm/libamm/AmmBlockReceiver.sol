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
            _getContext(S, _block, txIdx) :
            abi.decode(context, (AmmData.Context));

        if (poolTxData.length == 0) {
            // This marks end of all pool transactions for this block.
            S.poolTokenMintedSupply = ctx.poolTokenMintedSupply;
            S.poolTokenInPoolL2 = ctx.poolTokenInPoolL2;
            return (0, new bytes(0));
        }

        BlockReader.BlockHeader memory header = _block.readHeader();
        require(header.exchange == address(ctx.exchange), "INVALID_EXCHANGE");

        S.approveAmmUpdates(ctx, true);

        _processPoolTx(S, ctx, poolTxData);

        S.approveAmmUpdates(ctx, false);

        numTxConsumed = ctx.txIdx - txIdx;
        newContext = abi.encode(ctx);
    }

    function _getContext(
        AmmData.State      storage S,
        ExchangeData.Block memory  _block,
        uint                       txIdx
        )
        private
        view
        returns (AmmData.Context memory)
    {
        uint size = S.tokens.length;
        return AmmData.Context({
            _block: _block,
            txIdx: txIdx,
            exchange: S.exchange,
            exchangeDomainSeparator: S.exchange.getDomainSeparator(),
            domainSeparator: S.domainSeparator,
            accountID: S.accountID,
            poolTokenID: S.poolTokenID,
            poolTokenBase: AmmData.POOL_TOKEN_BASE(),
            poolTokenMintedSupply: S.poolTokenMintedSupply,
            poolTokenInPoolL2: S.poolTokenInPoolL2,
            size: size,
            tokens: S.tokens,
            tokenBalancesL2: new uint96[](size)
        });
    }

    function _processPoolTx(
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
}
