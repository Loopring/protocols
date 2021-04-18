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


/// @title AmmTransactionReceiver
library AmmTransactionReceiver
{
    using AmmExitProcess    for AmmData.State;
    using AmmJoinProcess    for AmmData.State;
    using AmmPoolToken      for AmmData.State;
    using AmmUpdateProcess  for AmmData.Context;
    using BlockReader       for bytes;

    function onReceiveTransactions(
        AmmData.State storage  S,
        bytes         calldata txsData,
        bytes         calldata callbackData
        )
        internal
    {
        AmmData.Context memory ctx = _getContext(S, txsData);

        ctx.approveAmmUpdates();

        _processPoolTx(S, ctx, callbackData);

        // Update state
        S._totalSupply = ctx.totalSupply;

        // Make sure we have consumed exactly the expected number of transactions
        require(txsData.length == ctx.txsDataPtr - ctx.txsDataPtrStart, "INVALID_NUM_TXS");
    }

    function _getContext(
        AmmData.State storage  S,
        bytes         calldata txsData
        )
        private
        view
        returns (AmmData.Context memory)
    {
        uint size = S.tokens.length;
        // Get the position of the txsData in the calldata
        uint txsDataPtr = 0;
        assembly {
            txsDataPtr := sub(add(txsData.offset, txsDataPtr), 32)
        }
        return AmmData.Context({
            txsDataPtr: txsDataPtr,
            txsDataPtrStart: txsDataPtr,
            domainSeparator: S.domainSeparator,
            accountID: S.accountID,
            poolTokenID: S.poolTokenID,
            feeBips: S.feeBips,
            totalSupply: S._totalSupply,
            tokens: S.tokens,
            tokenBalancesL2: new uint96[](size)
        });
    }

    function _processPoolTx(
        AmmData.State   storage  S,
        AmmData.Context memory   ctx,
        bytes           calldata callbackData
        )
        private
    {
        // abi.decode(callbackData, (AmmData.PoolTx));
        // Manually decode the encoded PoolTx in `callbackData`
        // The logic is equivalent to:
        // `AmmData.PoolTx memory poolTx = abi.decode(callbackData, (AmmData.PoolTx))`
        AmmData.PoolTxType txType;
        bytes calldata data;
        bytes calldata signature;
        assembly {
            txType := calldataload(add(callbackData.offset, 0x20))

            data.offset := add(add(callbackData.offset, 0x20), calldataload(add(callbackData.offset, 0x40)))
            data.length := calldataload(data.offset)
            data.offset := add(data.offset, 0x20)

            signature.offset := add(add(callbackData.offset, 0x20), calldataload(add(callbackData.offset, 0x60)))
            signature.length := calldataload(signature.offset)
            signature.offset := add(signature.offset, 0x20)
        }
        if (txType == AmmData.PoolTxType.JOIN) {
            S.processJoin(
                ctx,
                abi.decode(data, (AmmData.PoolJoin)),
                signature
            );
        } else if (txType == AmmData.PoolTxType.EXIT) {
            S.processExit(
                ctx,
                abi.decode(data, (AmmData.PoolExit)),
                signature
            );
        } else {
            revert("INVALID_POOL_TX_TYPE");
        }
    }
}
