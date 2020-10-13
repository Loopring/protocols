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
        AmmData.State      storage   S,
        ExchangeData.Block memory   _block,
        bytes              calldata data,
        uint                        txIdx,
        uint                        numTxs
        )
        internal
    {
        AmmData.Context memory ctx = _getContext(S, txIdx);

        require(numTxs == ctx.tokens.length * 2 + 1, "INVALID_NUM_TXS");

        BlockReader.BlockHeader memory header = _block.readHeader();
        require(header.exchange == address(ctx.exchange), "INVALID_EXCHANGE");

        S.approveAmmUpdates(ctx, _block);

        _processPoolTx(S, ctx, _block, data);

        // Approve transactions
        ctx.exchange.approveTransactions(ctx.transactionBuffer.owners, ctx.transactionBuffer.txHashes);

        // Update state
        S._totalSupply = ctx.totalSupply;
    }

    function _getContext(
        AmmData.State      storage S,
        uint                       txIdx
        )
        private
        view
        returns (AmmData.Context memory)
    {
        uint size = S.tokens.length;
        return AmmData.Context({
            txIdx: txIdx,
            exchange: S.exchange,
            exchangeDomainSeparator: S.exchangeDomainSeparator,
            domainSeparator: S.domainSeparator,
            accountID: S.accountID,
            poolTokenID: S.poolTokenID,
            totalSupply: S._totalSupply,
            tokens: S.tokens,
            tokenBalancesL2: new uint96[](size),
            transactionBuffer: AmmData.TransactionBuffer({
                size: 0,
                owners: new address[](size*2 + 1),
                txHashes: new bytes32[](size*2 + 1)
            })
        });
    }

    function _processPoolTx(
        AmmData.State           storage   S,
        AmmData.Context         memory    ctx,
        ExchangeData.Block      memory    _block,
        bytes                   calldata  poolTxData
        )
        private
    {
        AmmData.PoolTx memory poolTx = abi.decode(poolTxData, (AmmData.PoolTx));
        if (poolTx.txType == AmmData.PoolTxType.JOIN) {
            S.processJoin(
                ctx,
                _block,
                abi.decode(poolTx.data, (AmmData.PoolJoin)),
                poolTx.signature
            );
        } else if (poolTx.txType == AmmData.PoolTxType.EXIT) {
            S.processExit(
                ctx,
                _block,
                abi.decode(poolTx.data, (AmmData.PoolExit)),
                poolTx.signature
            );
        } else {
            revert("INVALID_POOL_TX_TYPE");
        }
    }
}
