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

        BlockReader.BlockHeader memory header = _block.readHeader();
        require(header.exchange == address(ctx.exchange), "INVALID_EXCHANGE");

        S.approveAmmUpdates(ctx, true);

        processPoolTx(S, ctx, poolTxData);

        S.approveAmmUpdates(ctx, false);

        return ctx.txIdx - txIdx;
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
            layer2Balances: new uint96[](size),
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
}
