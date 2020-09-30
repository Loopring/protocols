// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../lib/EIP712.sol";
import "../../lib/ERC20SafeTransfer.sol";
import "../../lib/MathUint.sol";
import "../../lib/MathUint96.sol";
import "../../thirdparty/SafeCast.sol";
import "./AmmExchange.sol";
import "./AmmData.sol";
import "./AmmStatus.sol";
import "./AmmUtil.sol";


/// @title AmmWithdrawal
library AmmWithdrawal
{
    using AmmExchange       for AmmData.State;
    using AmmStatus         for AmmData.State;
    using ERC20SafeTransfer for address;
    using MathUint          for uint;
    using MathUint96        for uint96;
    using SafeCast          for uint;

    // TODO: fix logical error and handle exitLocks
    function withdraw(AmmData.State storage S)
        public
    {
        // (uint[] memory amounts, uint newStartIndex) = getWithdrawables(S);
        // AmmData.User storage user = S.userMap[msg.sender];

        // // Clear pool token withdrawable

        // delete user.withdrawable[address(this)];
        // AmmUtil.transferOut(address(this), amounts[0], msg.sender);

        // // Clear each token's withdrawable
        // for (uint i = 0; i < S.tokens.length; i++) {
        //     delete user.withdrawable[S.tokens[i].addr];
        //     AmmUtil.transferOut(S.tokens[i].addr, amounts[i + 1], msg.sender);
        // }

        // // Delete expired joins
        // for (uint i = user.joinStartIdx; i < newStartIndex; i++) {
        //     delete S.approvedTx[user.joinLocks[i].txHash];
        //     delete user.joinLocks[i];
        // }

        // user.joinStartIdx = newStartIndex;

        // TODO: Transfer tokens back to the user
    }

    // TODO: fix logical error and handle exitLocks
    function getWithdrawables(AmmData.State storage S)
        internal
        view
        returns (
            uint[] memory amounts,
            uint   newStartIndex
        )
    {
        // uint size = S.tokens.length;
        // amounts = new uint[](size);

        // AmmData.User storage user = S.userMap[msg.sender];

        // for (uint i = 0; i < size; i++) {
        //     amounts[i] = user.withdrawable[S.tokens[i].addr];
        // }

        // uint idx = user.joinStartIdx;
        // while(idx < user.joinLocks.length) {
        //     AmmData.TokenLock storage record = user.joinLocks[idx];
        //     if (record.validUntil > block.timestamp) {
        //         return (amounts, idx);
        //     }

        //     if (S.approvedTx[record.txHash] > 0) {
        //         for (uint i = 0; i < size - 1; i++) {
        //             amounts[i] = amounts[i].add(record.amounts[i]);
        //         }
        //     }
        // }
        // return (amounts, idx);
    }

    // Only used to withdraw from the pool when shutdown.
    // Otherwise LPs should withdraw by doing normal queued exit requests.
    // TODO:
    function withdrawFromPoolWhenShutdown(
        AmmData.State storage S,
        uint                  burnAmount
        )
        public
    {
        require(burnAmount > 0, "INVALID_POOL_AMOUNT");
        require(S.balanceOf[msg.sender] >= burnAmount, "INSUFFCIENT_POOL_AMOUNT");

        uint size = S.tokens.length;
        uint32 accountID = S.accountID;
        IExchangeV3 exchange = S.exchange;
        bool withdrawalMode = exchange.isInWithdrawalMode();

        for (uint i = 0; i < size; i++) {
            address token = S.tokens[i].addr;

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

            // TODO: chec
        }

        // Withdraw proportionally to the liquidity owned
        // for (uint i = 0; i < size; i++) {
        //     address token = S.tokens[i].addr;

        //     // Calculate the balance inside the pool
        //     uint balance = token == address(0) ?
        //         address(this).balance :
        //         ERC20(token).balanceOf(address(this));

        //     // Withdraw the part owned by the pool
        //     uint amount = balance
        //         .sub(S.totalUserBalance[token])
        //         .mul(burnAmount) / S.totalSupply;

        //     AmmUtil.transferOut(token, amount, msg.sender);
        // }

        // S.burn(msg.sender, burnAmount);
    }
}
