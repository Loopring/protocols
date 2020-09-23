// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "./AmmData.sol";
import "../../../lib/ERC20.sol";
import "../../../lib/ERC20SafeTransfer.sol";
import "../../../lib/MathUint.sol";
import "../../../lib/MathUint96.sol";
import "../../../thirdparty/SafeCast.sol";
import "./AmmCommon.sol";


/// @title AmmExchange
library AmmExchange
{
    using ERC20SafeTransfer for address;
    using MathUint          for uint;
    using MathUint96        for uint96;
    using SafeCast          for uint;

    // Only used to withdraw from the pool when shutdown.
    // Otherwise LPs should withdraw by doing normal queued exit requests.
    function withdrawFromPoolWhenShutdown(
        AmmData.State storage S,
        uint                  poolAmountIn,
        uint                  totalSupply
        )
        external
    {
        // Currently commented out to make the contract size smaller...
        bool ready = true;
        if (S.exchange.isInWithdrawalMode()) {
            // Check if all tokens were withdrawn using Merkle proofs
            for (uint i = 0; i < S.tokens.length; i++) {
                ready = ready && !S.exchange.isWithdrawnInWithdrawalMode(S.accountID, S.tokens[i].addr);
            }
        } else {
            // Check if all forced withdrawals are done
            for (uint i = 0; i < S.tokens.length; i++) {
                ready = ready && !S.exchange.isForcedWithdrawalPending(S.accountID, S.tokens[i].addr);
            }
        }
        // Check that nothing is withdrawable anymore.
        for (uint i = 0; i < S.tokens.length; i++) {
            ready = ready && (S.exchange.getAmountWithdrawable(address(this), S.tokens[i].addr) == 0);
        }
        require(ready, "FUNDS_STILL_IN_EXCHANGE");

        // Withdraw proportionally to the liquidity owned
        for (uint i = 0; i < S.tokens.length; i++) {
            address token = S.tokens[i].addr;

            // Calculate the balance inside the pool
            uint contractBalance;
            if (token == address(0)) {
                contractBalance = address(this).balance;
            } else {
                contractBalance = ERC20(token).balanceOf(address(this));
            }
            // TODO?
            // uint tokenBalance = contractBalance.sub(S.totalBalance[token]);

            // Withdraw the part owned
            uint amount = poolAmountIn.mul(contractBalance) / totalSupply;
            AmmCommon.tranferOut(token, amount, msg.sender);
        }
    }
}
