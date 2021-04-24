// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../lib/ERC20.sol";
import "../../lib/MathUint.sol";
import "../../lib/TransferUtil.sol";
import "./AmmData.sol";
import "./AmmPoolToken.sol";
import "./AmmStatus.sol";
import "./AmmUtil.sol";


/// @title AmmWithdrawal
library AmmWithdrawal
{
    using AmmPoolToken      for AmmData.State;
    using AmmStatus         for AmmData.State;
    using MathUint          for uint;
    using TransferUtil      for address;

    function withdrawWhenOffline(
        AmmData.State storage S
        )
        public
    {
        _checkWithdrawalConditionInShutdown(S);

        // Burn the full balance
        uint poolAmount = S.balanceOf[msg.sender];
        if (poolAmount > 0) {
            S.transfer(address(this), poolAmount);
        }

        // Burn any additional pool tokens stuck in forced exits
        AmmData.PoolExit storage exit = S.forcedExit[msg.sender];
        if (exit.burnAmount > 0) {
            poolAmount = poolAmount.add(exit.burnAmount);
            delete S.forcedExit[msg.sender];
        }

        require(poolAmount > 0, "ZERO_POOL_AMOUNT");

        // Withdraw the part owned of the pool
        uint totalSupply = S.totalSupply();
        for (uint i = 0; i < S.tokens.length; i++) {
            address token = S.tokens[i].addr;
            uint balance = token.selfBalance();
            uint amount = balance.mul(poolAmount) / totalSupply;
            token.transferOut(msg.sender, amount);
        }

        S._totalSupply = S._totalSupply.sub(poolAmount);
    }

    function _checkWithdrawalConditionInShutdown(
        AmmData.State storage S
        )
        private
        view
    {
        IExchangeV3 exchange = S.exchange;
        bool withdrawalMode = exchange.isInWithdrawalMode();

        for (uint i = 0; i < S.tokens.length; i++) {
            address token = S.tokens[i].addr;

            require(
                withdrawalMode && exchange.isWithdrawnInWithdrawalMode(S.accountID, token) ||
                !withdrawalMode && !exchange.isForcedWithdrawalPending(S.accountID, token),
                "PENDING_WITHDRAWAL"
            );

            // Check that nothing is withdrawable anymore.
            require(
                exchange.getAmountWithdrawable(address(this), token) == 0,
                "MORE_TO_WITHDRAW"
            );
        }
    }
}
