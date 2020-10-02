// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../lib/EIP712.sol";
import "../../lib/ERC20SafeTransfer.sol";
import "../../lib/MathUint.sol";
import "../../lib/MathUint96.sol";
import "../../lib/SignatureUtil.sol";
import "../../thirdparty/SafeCast.sol";
import "./AmmData.sol";
import "./AmmPoolToken.sol";
import "./AmmStatus.sol";
import "./AmmUtil.sol";


/// @title AmmWithdrawal
library AmmWithdrawal
{
    using AmmPoolToken      for AmmData.State;
    using AmmStatus         for AmmData.State;
    using ERC20SafeTransfer for address;
    using MathUint          for uint;
    using MathUint96        for uint96;
    using SafeCast          for uint;
    using SignatureUtil     for bytes32;

    function withdrawInShutdown(
        AmmData.State storage S
        )
        public
    {
        _checkWithdrawalConditionInShutdown(S);

        uint burnAmount = S.balanceOf[msg.sender];
        bytes32 exitHash = S.isExiting[msg.sender];

        if (exitHash != 0) {
            burnAmount = burnAmount.add(S.forcedExit[exitHash].burnAmount);
            delete S.forcedExit[exitHash];
            delete S.isExiting[msg.sender];
        }

        require(burnAmount > 0, "INVALID_POOL_AMOUNT");

        _withdrawFromApprovedWithdrawals(S);

        // Withdraw proportionally to the liquidity owned, including the pool token itself
        uint size = S.tokens.length;

        for (uint i = 0; i < size; i++) {
            address token = S.tokens[i].addr;
            uint balance = token == address(0) ?
                address(this).balance :
                ERC20(token).balanceOf(address(this));

            // Withdraw the part owned by the pool
            uint amount = balance.mul(burnAmount) / S.effectiveTotalSupply();
            AmmUtil.transferOut(token, amount, msg.sender);
        }

        S.burn(msg.sender, burnAmount);
    }

    function _checkWithdrawalConditionInShutdown(AmmData.State storage S)
        private
        view
    {
        IExchangeV3 exchange = S.exchange;
        bool withdrawalMode = exchange.isInWithdrawalMode();

        uint size = S.tokens.length;
        for (uint i = 0; i < size; i++) {
            address token = S.tokens[i].addr;

            require(
                withdrawalMode && exchange.isWithdrawnInWithdrawalMode(S.accountID, token) ||
                !withdrawalMode && !exchange.isForcedWithdrawalPending(S.accountID, token),
                "PENDING_WITHDRAWAL"
            );

            // Check that nothing is withdrawable anymore.
            require(
                exchange.getAmountWithdrawable(address(this), token) == 0,
                "MORE_TO_WITHDRAWAL"
            );
        }
    }

    function _withdrawFromApprovedWithdrawals(
        AmmData.State storage S
        )
        private
    {
        uint size = S.tokens.length;
        address[] memory owners = new address[](size);
        address[] memory tokens = new address[](size);

        for (uint i = 0; i < size; i++) {
            owners[i] = address(this);
            tokens[i] = S.tokens[i].addr;
        }
        S.exchange.withdrawFromApprovedWithdrawals(owners, tokens);
    }
}
