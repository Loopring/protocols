// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../core/impl/libtransactions/BlockReader.sol";
import "../../lib/MathUint.sol";
import "../../thirdparty/SafeCast.sol";
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
    using AmmUtil           for AmmData.State;
    using AmmUpdateProcess  for AmmData.Context;
    using BlockReader       for bytes;
    using MathUint          for uint;
    using MathUint96        for uint96;
    using SafeCast          for uint;

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
            ctx.approveAmmUpdates(true);
            S.processJoin(
                ctx,
                abi.decode(data, (AmmData.PoolJoin)),
                signature
            );
            ctx.approveAmmUpdates(false);
        } else if (txType == AmmData.PoolTxType.EXIT) {
            ctx.approveAmmUpdates(true);
            S.processExit(
                ctx,
                abi.decode(data, (AmmData.PoolExit)),
                signature
            );
            ctx.approveAmmUpdates(false);
        } else if (txType == AmmData.PoolTxType.SET_VIRTUAL_BALANCES) {
            ctx.approveAmmUpdates(true);
            ctx.vTokenBalancesL2 = ctx.settings.controller.getVirtualBalances(ctx.tokenBalancesL2, ctx.vTokenBalancesL2);
            ctx.approveAmmUpdates(false);
        } else if (txType == AmmData.PoolTxType.DEPOSIT) {
            AmmData.PoolDeposit memory poolDeposit = abi.decode(data, (AmmData.PoolDeposit));
            require(poolDeposit.amounts.length == ctx.tokens.length, "INVALID_DEPOSIT_AMOUNTS");
            for (uint i = 0; i < ctx.tokens.length; i++) {
                deposit(S, ctx.tokens[i].addr, poolDeposit.amounts[i]);
            }
        } else if (txType == AmmData.PoolTxType.WITHDRAW) {
            AmmData.PoolWithdrawal memory poolWithdrawal = abi.decode(data, (AmmData.PoolWithdrawal));
            require(poolWithdrawal.amounts.length == ctx.tokens.length, "INVALID_WITHDRAWAL_AMOUNTS");
            for (uint i = 0; i < ctx.tokens.length; i++) {
                withdraw(ctx, ctx.tokens[i].tokenID, poolWithdrawal.amounts[i]);
            }
        } else {
            revert("INVALID_POOL_TX_TYPE");
        }
    }

    function deposit(
        AmmData.State storage S,
        address               token,
        uint96                amount
        )
        internal
    {
        if (amount == 0) {
            return;
        }
        uint ethValue = 0;
        if (token == address(0)) {
            ethValue = amount;
        } else {
            ERC20(token).approve(address(S.exchange.getDepositContract()), amount);
        }
        S.exchange.deposit{value: ethValue}(
            address(this),
            address(this),
            token,
            amount,
            new bytes(0)
        );
    }

    function withdraw(
        AmmData.Context memory ctx,
        uint                   tokenID,
        uint96                 amount
        )
        internal
        view
    {
        if (amount == 0) {
            return;
        }

        bytes20 onchainDataHash = WithdrawTransaction.hashOnchainData(
            0,                  // Withdrawal needs to succeed no matter the gas coast
            address(this),      // Withdraw to this contract first
            new bytes(0)
        );

        // Verify withdrawal data
        // Start by reading the first 2 bytes into header
        uint txsDataPtr = ctx.txsDataPtr + 2;
        // header: txType (1) | type (1)
        uint header;
        // packedData: tokenID (2) | amount (12) | feeTokenID (2) | fee (2)
        uint packedData;
        bytes20 dataHash;
        assembly {
            header     := calldataload(    txsDataPtr     )
            packedData := calldataload(add(txsDataPtr, 42))
            dataHash   := and(calldataload(add(txsDataPtr, 78)), 0xffffffffffffffffffffffffffffffffffffffff000000000000000000000000)
        }
        require(
            // txType == ExchangeData.TransactionType.WITHDRAWAL &&
            // withdrawal.type == 1 &&
            header & 0xffff == (uint(ExchangeData.TransactionType.WITHDRAWAL) << 8) | 1 &&
            // withdrawal.tokenID == token.tokenID &&
            // withdrawal.amount == token.amount &&
            // withdrawal.fee == 0,
            packedData & 0xffffffffffffffffffffffffffff0000ffff == (uint(tokenID) << 128) | (uint(amount) << 32) &&
            onchainDataHash == dataHash,
            "INVALID_WITHDRAWAL_TX_DATA"
        );

        ctx.txsDataPtr += ExchangeData.TX_DATA_AVAILABILITY_SIZE;
    }
}
