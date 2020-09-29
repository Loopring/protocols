// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../core/impl/libtransactions/BlockReader.sol";
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

    function beforeBlockSubmission(
        AmmData.State      storage S,
        ExchangeData.Block memory  _block,
        uint                       txIdx,
        bytes              memory  auxiliaryData
        )
        public
        returns (uint)
    {
        require(S.poolAmountToBurn == 0, "POOL_TOKEN_MUST_BE_BURNED");

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
            domainSeparator: S.domainSeparator,
            exchangeDomainSeparator: S.exchange.getDomainSeparator(),
            accountID: S.accountID,
            ammActualL2Balances: new uint96[](size),
            ammExpectedL2Balances: new uint96[](size),
            numTransactionsConsumed: 0,
            tokens: S.tokens,
            size: size,
            poolTokenBase: AmmData.LP_TOKEN_BASE(),
            poolTokenInitialSupply: AmmData.LP_TOKEN_INITIAL_SUPPLY(),
            poolAmountToBurn: 0
        });

        BlockReader.BlockHeader memory header = _block.readHeader();
        require(header.exchange == address(ctx.exchange), "INVALID_EXCHANGE");

        // The openning AMM updates. This also pulls the AMM balances onchain.
        S.processAmmUpdates(ctx, true);

        // Process all pool transactions
        for (uint i = 0; i < poolTransactions.length; i++) {
            _processPoolTransaction(S, ctx, poolTransactions[i]);
        }

        // Deposit to or withdraw from the AMM account when necessary, this includes the pool token.
        for (uint i = 0; i < size; i++) {
            _processPoolBalance(
                ctx,
                ctx.tokens[i],
                ctx.ammExpectedL2Balances[i],
                ctx.ammActualL2Balances[i]
            );
        }

        // The closing AMM updates
        S.processAmmUpdates(ctx, false);

        // Save the pool tokens to burn
        S.poolAmountToBurn = ctx.poolAmountToBurn;

        return ctx.numTransactionsConsumed;
    }

    function afterBlockSubmission(
        AmmData.State      storage S,
        ExchangeData.Block memory  /* _block */
        )
        public
    {
        S.processApprovedWithdrawals(address(this));

        uint poolAmountToBurn = S.poolAmountToBurn;
        if (poolAmountToBurn > 0) {
            S.poolAmountToBurn = 0;
            S.burn(address(this), poolAmountToBurn);
        }
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
        } else {
            revert("INVALID_TYPE");
        }
    }

    function _processPoolBalance(
        AmmData.Context memory  ctx,
        AmmData.Token   memory  token,
        uint96                  ammExpectedL2Balance,
        uint96                  ammActualL2Balance
        )
        private
    {
        if (ammExpectedL2Balance > ammActualL2Balance) {
            AmmJoinProcess.processTokenDeposit(
                ctx,
                token,
                ammExpectedL2Balance - ammActualL2Balance
            );
        } else if (ammExpectedL2Balance < ammActualL2Balance) {
            AmmExitProcess.processTokenWithdrawal(
                ctx,
                token,
                ammActualL2Balance - ammExpectedL2Balance
            );
        }
    }
}
