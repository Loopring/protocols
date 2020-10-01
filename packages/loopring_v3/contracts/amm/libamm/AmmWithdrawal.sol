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
import "./AmmExchange.sol";
import "./AmmData.sol";
import "./AmmPoolToken.sol";
import "./AmmStatus.sol";
import "./AmmUtil.sol";


/// @title AmmWithdrawal
library AmmWithdrawal
{
    using AmmExchange       for AmmData.State;
    using AmmPoolToken      for AmmData.State;
    using AmmStatus         for AmmData.State;
    using ERC20SafeTransfer for address;
    using MathUint          for uint;
    using MathUint96        for uint96;
    using SafeCast          for uint;
    using SignatureUtil     for bytes32;

    bytes32 constant public WITHDRAW_TYPEHASH = keccak256(
        "Withdraw(address joinOwner,uint256 joinOwner,uint256 validUntil)"
    );

    function withdraw(AmmData.State storage S)
        public
    {
        (uint newJoinLocksStartIdx, uint96[] memory amounts) = getWithdrawableAmounts(S, msg.sender);

        AmmData.TokenLock[] storage joinLocks = S.joinLocks[msg.sender];
        uint oldJoinLocksStartIdx = S.joinLocksStartIdx[msg.sender];
        S.joinLocksStartIdx[msg.sender] = newJoinLocksStartIdx;

        for (uint i = oldJoinLocksStartIdx; i < newJoinLocksStartIdx; i++) {
            delete S.approvedTx[joinLocks[i].txHash];
            delete joinLocks[i];
        }

        for (uint i = 0; i < S.tokens.length; i++) {
            address token = S.tokens[i].addr;
            delete S.withdrawable[token][msg.sender];
            AmmUtil.transferOut(token, amounts[i], msg.sender);
        }
    }

    function withdrawInShutdown(
        AmmData.State storage S
        )
        public
    {
        uint burnAmount = S.balanceOf[msg.sender];
        require(burnAmount > 0, "INVALID_POOL_AMOUNT");

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

        // Withdraw proportionally to the liquidity owned, including the pool token itself
        for (uint i = 0; i < size; i++) {
            address token = S.tokens[i].addr;

            uint balance = token == address(0) ?
                address(this).balance :
                ERC20(token).balanceOf(address(this));

            // Withdraw the part owned by the pool
            uint amount = balance
                .sub(S.withdrawableBeforeShutdown[token])
                .mul(burnAmount) / S.totalSupply;

            AmmUtil.transferOut(token, amount, msg.sender);
        }

        S.burn(msg.sender, burnAmount);
    }

    function getWithdrawableAmounts(
        AmmData.State storage S,
        address               owner
        )
        internal
        view
        returns (uint, uint96[] memory)
    {
        uint size = S.tokens.length;

        uint newJoinLocksStartIdx = S.joinLocksStartIdx[owner];
        uint96[] memory amounts = new uint96[](size);

        for (uint i = 0; i < size; i++) {
            amounts[i] = S.withdrawable[S.tokens[i].addr][owner];
        }

        AmmData.TokenLock[] storage joinLocks = S.joinLocks[owner];
        for (uint i = newJoinLocksStartIdx; i < joinLocks.length; i++) {
            AmmData.TokenLock storage lock = joinLocks[i];
            uint validUntil = S.approvedTx[lock.txHash];

            if (validUntil <= block.timestamp) {
                newJoinLocksStartIdx++;
                if (lock.amounts.length == 1) {
                    amounts[size - 1] = amounts[size - 1].add(lock.amounts[0]);
                } else if (lock.amounts.length == size - 1) {
                    for (uint j = 0; j < size - 1; j++) {
                        amounts[j] = amounts[j].add(lock.amounts[j]);
                    }
                }
            } else {
                return (newJoinLocksStartIdx, amounts);
            }
        }
        return (newJoinLocksStartIdx, amounts);
    }

    function _checkJoinWithdrawalOperatorApproval(
        AmmData.State storage S,
        address               joinOwner,
        address               joinNonce,
        uint                  validUntil,
        bytes        calldata signature
        )
        private
        view
    {
        require(validUntil > block.timestamp, 'SIGNATURE_EXPIRED');

        bytes32 hash = EIP712.hashPacked(
            S.domainSeparator,
            keccak256(
                abi.encode(
                    WITHDRAW_TYPEHASH,
                    joinOwner,
                    joinNonce,
                    validUntil
                )
            )
        );
        require(
            hash.verifySignature(S.exchange.owner(), signature),
            "INVALID_SIGNATURE"
        );
    }
}
