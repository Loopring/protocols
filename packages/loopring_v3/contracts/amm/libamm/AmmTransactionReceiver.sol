// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../core/impl/libtransactions/BlockReader.sol";
import "../../lib/MathUint.sol";
import "../../thirdparty/SafeCast.sol";
import "./AmmDepositProcess.sol";
import "./AmmData.sol";
import "./AmmExitProcess.sol";
import "./AmmJoinProcess.sol";
import "./AmmPoolToken.sol";
import "./AmmUpdateProcess.sol";
import "./AmmWithdrawProcess.sol";


/// @title AmmTransactionReceiver
library AmmTransactionReceiver
{
    using AmmDepositProcess  for AmmData.State;
    using AmmExitProcess     for AmmData.State;
    using AmmJoinProcess     for AmmData.State;
    using AmmPoolToken       for AmmData.State;
    using AmmUtil            for AmmData.State;
    using AmmUpdateProcess   for AmmData.State;
    using AmmWithdrawProcess for AmmData.State;
    using BlockReader        for bytes;
    using MathUint           for uint;
    using MathUint96         for uint96;
    using SafeCast           for uint;

    function onReceiveTransactions(
        AmmData.State    storage  S,
        bytes            calldata txsData,
        bytes            calldata callbackData,
        AmmData.Settings memory   settings
        )
        internal
    {
        AmmData.Context memory ctx = _getContext(S, txsData, settings);

        _processPoolTx(S, ctx, callbackData);

        // Update state
        S._totalSupply = ctx.totalSupply;

        // Make sure we have consumed exactly the expected number of transactions
        require(txsData.length == ctx.txsDataPtr - ctx.txsDataPtrStart, "INVALID_NUM_TXS");
    }

    function _getContext(
        AmmData.State    storage   S,
        bytes            calldata  txsData,
        AmmData.Settings memory    settings
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
            tokenBalancesL2: new uint96[](size),
            vTokenBalancesL2: new uint96[](size),
            settings: settings
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
            S.approveAmmUpdates(ctx, true);
            S.processJoin(
                ctx,
                abi.decode(data, (AmmData.PoolJoin)),
                signature
            );
            S.approveAmmUpdates(ctx, false);
        } else if (txType == AmmData.PoolTxType.EXIT) {
            S.approveAmmUpdates(ctx, true);
            S.processExit(
                ctx,
                abi.decode(data, (AmmData.PoolExit)),
                signature
            );
            S.approveAmmUpdates(ctx, false);
        } else if (txType == AmmData.PoolTxType.SET_VIRTUAL_BALANCES) {
            S.approveAmmUpdates(ctx, true);
            processSetVirtualBalances(
                S,
                ctx,
                abi.decode(data, (AmmData.PoolVirtualBalances))
            );
            S.approveAmmUpdates(ctx, false);
        } else if (txType == AmmData.PoolTxType.DEPOSIT) {
            S.processDeposit(
                ctx,
                abi.decode(data, (AmmData.PoolDeposit))
            );
         } else if (txType == AmmData.PoolTxType.WITHDRAW) {
             S.processWithdrawal(
                ctx,
                abi.decode(data, (AmmData.PoolWithdrawal))
            );
        } else {
            revert("INVALID_POOL_TX_TYPE");
        }
    }

    function processSetVirtualBalances(
        AmmData.State               storage /*S*/,
        AmmData.Context             memory  ctx,
        AmmData.PoolVirtualBalances memory  poolVirtualBalances
        )
        internal
    {
        require(poolVirtualBalances.vBalancesNew.length == ctx.tokens.length, "INVALID_DATA");
        require(
            ctx.settings.controller.authorizeVirtualBalances(
                ctx.tokenBalancesL2,
                ctx.vTokenBalancesL2,
                poolVirtualBalances.vBalancesNew,
                poolVirtualBalances.data
            ),
            "NEW_VIRTUAL_BALANCES_NOT_AUTHORIZED"
        );
        ctx.vTokenBalancesL2 = poolVirtualBalances.vBalancesNew;
    }
}
