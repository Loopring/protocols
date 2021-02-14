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
    using BlockReader       for bytes;

    function beforeBlockSubmission(
        AmmData.State      storage  S,
        bytes              memory   txsData,
        bytes              calldata data,
        uint                        txIdx,
        uint                        numTxs
        )
        internal
    {
        AmmData.Context memory ctx = _getContext(S, txIdx);

        S.approveAmmUpdates(ctx, txsData);

        _processPoolTx(S, ctx, txsData, data);

        // Update state
        S._totalSupply = ctx.totalSupply;

        // Make sure we have consumed exactly the expected number of transactions
        require(numTxs == (ctx.txIdx - txIdx), "INVALID_NUM_TXS");
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
            domainSeparator: S.domainSeparator,
            accountID: S.accountID,
            poolTokenID: S.poolTokenID,
            totalSupply: S._totalSupply,
            tokens: S.tokens,
            tokenBalancesL2: new uint96[](size),
            txData: new bytes(ExchangeData.TX_DATA_AVAILABILITY_SIZE)
        });
    }

    function _processPoolTx(
        AmmData.State           storage   S,
        AmmData.Context         memory    ctx,
        bytes                   memory    txsData,
        bytes                   calldata  poolTxData
        )
        private
    {
        AmmData.PoolTx memory poolTx = abi.decode(poolTxData, (AmmData.PoolTx));
        if (poolTx.txType == AmmData.PoolTxType.JOIN) {
            S.processJoin(
                ctx,
                txsData,
                abi.decode(poolTx.data, (AmmData.PoolJoin)),
                poolTx.signature
            );
        } else if (poolTx.txType == AmmData.PoolTxType.EXIT) {
            S.processExit(
                ctx,
                txsData,
                abi.decode(poolTx.data, (AmmData.PoolExit)),
                poolTx.signature
            );
        } else {
            revert("INVALID_POOL_TX_TYPE");
        }
    }
}
