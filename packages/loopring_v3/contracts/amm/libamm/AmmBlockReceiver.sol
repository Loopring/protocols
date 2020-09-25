// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../core/impl/libtransactions/BlockReader.sol";
import "./AmmData.sol";
import "./AmmExitProcess.sol";
import "./AmmJoinProcess.sol";
import "./AmmUpdateProcess.sol";


/// @title AmmBlockReceiver
library AmmBlockReceiver
{
    using AmmExitProcess    for AmmData.State;
    using AmmJoinProcess    for AmmData.State;
    using AmmUpdateProcess  for AmmData.State;
    using BlockReader       for ExchangeData.Block;

    function beforeBlockSubmitted(
        AmmData.State      storage S,
        uint                       poolTokenTotalSupply,
        ExchangeData.Block memory  _block,
        uint                       txIdx,
        bytes              memory  auxiliaryData
        )
        public
        returns (uint)
    {
        AmmData.PoolTransaction[] memory poolTransactions = abi.decode(
            auxiliaryData,
            (AmmData.PoolTransaction[])
        );

        // Cache the domain seperator to save on SLOADs each time it is accessed.
        uint size = S.tokens.length;
        AmmData.Context memory ctx = AmmData.Context({
            _block: _block,
            exchange: S.exchange,
            exchangeDepositContract: address(S.exchange.getDepositContract()),
            txIdx: txIdx,
            domainSeperator: S.domainSeperator,
            exchangeDomainSeparator: S.exchange.getDomainSeparator(),
            ammActualL2Balances: new uint96[](size),
            ammExpectedL2Balances: new uint96[](size),
            numTransactionsConsumed: 0,
            tokens: S.tokens,
            size: size,
            poolTokenTotalSupply: poolTokenTotalSupply,
            poolTokenBase: AmmData.LP_TOKEN_BASE(),
            poolTokenInitialSupply: AmmData.LP_TOKEN_INITIAL_SUPPLY()
        });

        BlockReader.BlockHeader memory header = _block.readHeader();
        require(header.exchange == address(ctx.exchange), "INVALID_EXCHANGE");

        // The openning AMM updates
        // This also pulls the AMM balances onchain.
        S.processAmmUpdates(ctx, true);

        // Process all pool transactions
        for (uint i = 0; i < poolTransactions.length; i++) {
            _processPoolTransaction(S, ctx, poolTransactions[i]);
        }

        // Deposit/Withdraw to/from the AMM account when necessary
        for (uint i = 0; i < size; i++) {
            _processPoolBalance(
                S,
                ctx,
                ctx.tokens[i],
                ctx.ammExpectedL2Balances[i],
                ctx.ammActualL2Balances[i]
            );
        }

        // The closing AMM updates
        S.processAmmUpdates(ctx, false);

        return ctx.numTransactionsConsumed;
    }

    function _processPoolTransaction(
        AmmData.State           storage S,
        AmmData.Context         memory  ctx,
        AmmData.PoolTransaction memory  poolTx
        )
        private
    {
        if (poolTx.txType == AmmData.PoolTransactionType.JOIN) {
            S.processJoin(
                ctx,
                abi.decode(poolTx.data, (AmmData.PoolJoin)),
                poolTx.signature
            );
        } else if (poolTx.txType == AmmData.PoolTransactionType.EXIT) {
            S.processExit(
                ctx,
                abi.decode(poolTx.data, (AmmData.PoolExit)),
                poolTx.signature
            );
        }
    }

    function _processPoolBalance(
        AmmData.State   storage S,
        AmmData.Context memory  ctx,
        AmmData.Token   memory  token,
        uint96                  ammExpectedL2Balance,
        uint96                  ammActualL2Balance
        )
        private
    {
        if (ammExpectedL2Balance > ammActualL2Balance) {
            S.proxcessExchangeDeposit(
                ctx,
                token,
                ammExpectedL2Balance - ammActualL2Balance
            );
        } else if (ammExpectedL2Balance < ammActualL2Balance) {
            S.proxcessExchangeWithdrawal(
                ctx,
                token,
                ammActualL2Balance - ammExpectedL2Balance
            );
        }
    }
}
