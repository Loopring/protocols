// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../lib/ERC20.sol";
import "../../lib/MathUint.sol";
import "./AmmData.sol";
import "./AmmPoolToken.sol";
import "./AmmUtil.sol";


/// @title AmmExchange
library AmmExchange
{
    using AmmPoolToken      for AmmData.State;
    using MathUint          for uint;

    // Only used to withdraw from the pool when shutdown.
    // Otherwise LPs should withdraw by doing normal queued exit requests.
    function withdrawFromPoolWhenShutdown(
        AmmData.State storage S,
        uint                  poolAmountIn
        )
        public
    {
        require(poolAmountIn > 0, "INVALID_POOL_AMOUNT");
        require(S.balanceOf[msg.sender] >= poolAmountIn, "INSUFFCIENT_POOL_AMOUNT");

        uint size = S.tokens.length;
        uint32 accountID = S.accountID;
        IExchangeV3 exchange = S.exchange;
        bool withdrawalMode = exchange.isInWithdrawalMode();

        for (uint i = 0; i < size; i++) {
            address token = S.tokens[i].addr;

            // Question(Brecht): I removed a "!" isWithdrawnInWithdrawalMode, is it now correct?
            require(
                withdrawalMode && exchange.isWithdrawnInWithdrawalMode(accountID, token) ||
                !withdrawalMode && !exchange.isForcedWithdrawalPending(accountID, token),
                "PENDING_WITHDRAWAL"
            );

            // Check that nothing is withdrawable anymore.
            require(
                exchange.getAmountWithdrawable(address(this), token) == 0,
                "MORE_TO_WITHDRAWAL"
            );
        }

        // Withdraw proportionally to the liquidity owned
        for (uint i = 0; i < size; i++) {
            address token = S.tokens[i].addr;

            // Calculate the balance inside the pool
            uint balance = token == address(0) ?
                address(this).balance :
                ERC20(token).balanceOf(address(this));

            // Withdraw the part owned
            uint amount = balance.mul(poolAmountIn) / S.totalSupply;
            AmmUtil.tranferOut(token, amount, msg.sender);
        }

        S.burn(msg.sender, poolAmountIn);
    }
}
