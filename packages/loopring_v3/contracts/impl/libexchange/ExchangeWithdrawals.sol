// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.6.10;
pragma experimental ABIEncoderV2;

import "../../iface/ExchangeData.sol";

import "../../lib/AddressUtil.sol";
import "../../thirdparty/BytesUtil.sol";

import "./ExchangeBalances.sol";
import "./ExchangeMode.sol";
import "./ExchangeTokens.sol";


/// @title ExchangeWithdrawals.
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
library ExchangeWithdrawals
{
    using AddressUtil       for address;
    using AddressUtil       for address payable;
    using BytesUtil         for bytes;
    using MathUint          for uint;
    using ExchangeBalances  for ExchangeData.State;
    using ExchangeMode      for ExchangeData.State;
    using ExchangeTokens    for ExchangeData.State;

    event ForcedWithdrawalRequested(
        address owner,
        address token,
        uint24   accountID
    );

    event WithdrawalCompleted(
        address from,
        address to,
        address token,
        uint96  amount
    );

    event WithdrawalFailed(
        address from,
        address to,
        address token,
        uint96  amount
    );

    function forceWithdraw(
        ExchangeData.State storage S,
        address owner,
        address token,
        uint24  accountID
        )
        external
    {
        require(!S.isInWithdrawalMode(), "INVALID_MODE");
        require(S.getNumAvailableForcedSlots() > 0, "TOO_MANY_REQUESTS_OPEN");
        require(accountID != 1 && accountID < ExchangeData.MAX_NUM_ACCOUNTS(), "INVALID_ACCOUNTID");

        uint16 tokenID = S.getTokenID(token);

        uint withdrawalFeeETH = S.loopring.forcedWithdrawalFee();

        // Check ETH value sent, can be larger than the expected withdraw fee
        require(msg.value >= withdrawalFeeETH, "INSUFFICIENT_FEE");

        // Send surplus of ETH back to the sender
        uint feeSurplus = msg.value.sub(withdrawalFeeETH);
        if (feeSurplus > 0) {
            msg.sender.sendETHAndVerify(feeSurplus, gasleft());
        }

        require(S.pendingForcedWithdrawals[accountID][tokenID].timestamp == 0, "WITHDRAWAL_ALREADY_PENDING");

        S.pendingForcedWithdrawals[accountID][tokenID].owner = owner;
        S.pendingForcedWithdrawals[accountID][tokenID].timestamp = uint32(now);
        S.pendingForcedWithdrawals[accountID][tokenID].fee = uint64(withdrawalFeeETH);

        S.numPendingForcedTransactions++;

        emit ForcedWithdrawalRequested(
            owner,
            token,
            accountID
        );
    }

    // We still alow anyone to withdraw these funds for the account owner
    function withdrawFromMerkleTree(
        ExchangeData.State       storage S,
        ExchangeData.MerkleProof calldata merkleProof
        )
        external
    {
        require(S.isInWithdrawalMode(), "NOT_IN_WITHDRAW_MODE");

        address owner = merkleProof.accountLeaf.owner;
        uint24 accountID = merkleProof.accountLeaf.accountID;
        uint16 tokenID = merkleProof.balanceLeaf.tokenID;
        uint96 balance = merkleProof.balanceLeaf.balance;

        require(S.withdrawnInWithdrawMode[accountID][tokenID] == false, "WITHDRAWN_ALREADY");

        ExchangeBalances.verifyAccountBalance(
            uint(S.merkleRoot),
            merkleProof
        );

        // Make sure the balance can only be withdrawn once
        S.withdrawnInWithdrawMode[accountID][tokenID] = true;

        // Transfer the tokens
        transferTokens(
            S,
            owner,
            owner,
            tokenID,
            balance,
            new bytes(0),
            gasleft(),
            false
        );
    }

    function withdrawFromDepositRequest(
        ExchangeData.State storage S,
        address owner,
        address token,
        uint    index
        )
        external
    {
        uint16 tokenID = S.getTokenID(token);
        ExchangeData.Deposit storage deposit = S.pendingDeposits[owner][tokenID][index];
        require(deposit.timestamp != 0, "DEPOSIT_NOT_WITHDRAWABLE_YET");

        // Check if the deposit has indeed exceeded the time limit
        require(now >= deposit.timestamp + S.maxAgeDepositUntilWithdrawable, "DEPOSIT_NOT_WITHDRAWABLE_YET");

        uint amount = deposit.amount;
        uint fee = deposit.fee;

        // Reset the deposit request
        S.pendingDeposits[owner][tokenID][index] = ExchangeData.Deposit(0, 0, 0);

        // Transfer the tokens
        transferTokens(
            S,
            owner,
            owner,
            tokenID,
            amount,
            new bytes(0),
            gasleft(),
            false
        );

        // Return the fee
        owner.sendETHAndVerify(fee, gasleft());
    }

    function withdrawFromApprovedWithdrawals(
        ExchangeData.State storage S,
        address[] memory owners,
        address[] memory tokens
        )
        public
    {
        require(owners.length == tokens.length, "INVALID_INPUT_DATA");
        for (uint i = 0; i < owners.length; i++) {
            address owner = owners[i];
            uint16 tokenID = S.getTokenID(tokens[i]);
            uint amount = S.amountWithdrawable[owner][tokenID];

            // Make sure this amount can't be withdrawn again
            S.amountWithdrawable[owner][tokenID] = 0;

            // Transfer the tokens
            transferTokens(
                S,
                owner,
                owner,
                tokenID,
                amount,
                new bytes(0),
                gasleft(),
                false
            );
        }
    }

    function distributeWithdrawal(
        ExchangeData.State storage S,
        address from,
        address to,
        uint16  tokenID,
        uint    amount,
        bytes   memory auxiliaryData,
        uint    gasLimit
        )
        public
    {
        // Try to transfer the tokens
        bool success = transferTokens(
            S,
            from,
            to,
            tokenID,
            amount,
            auxiliaryData,
            gasLimit,
            true
        );
        if (!success) {
            // Allow the amount to be withdrawn using `withdrawFromApprovedWithdrawal`.
            S.amountWithdrawable[to][tokenID] = S.amountWithdrawable[to][tokenID].add(amount);
        }
    }

    // == Internal and Private Functions ==

    // If allowFailure is true the transfer can fail because of a transfer error or
    // because the transfer uses more than `gasLimit` gas. The function
    // will return true when successful, false otherwise.
    // If allowFailure is false the transfer is guaranteed to succeed using
    // as much gas as needed, otherwise it throws. The function always returns true.
    function transferTokens(
        ExchangeData.State storage S,
        address from,
        address to,
        uint16  tokenID,
        uint    amount,
        bytes   memory auxiliaryData,
        uint    gasLimit,
        bool    allowFailure
        )
        private
        returns (bool success)
    {
        if (to == address(0)) {
            to = S.loopring.protocolFeeVault();
        }
        address token = S.getTokenAddress(tokenID);

        // Transfer the tokens from the deposit contract to the owner
        if (gasLimit > 0) {
            try S.depositContract.withdraw{gas: gasLimit}(to, token, amount, auxiliaryData) {
                success = true;
            } catch {
                success = false;
            }
        } else {
            success = false;
        }

        if (!allowFailure) {
            require(success, "TRANSFER_FAILURE");
        }

        if (success) {
            emit WithdrawalCompleted(
                from,
                to,
                token,
                uint96(amount)
            );
            if (from == address(0)) {
                S.protocolFeeLastWithdrawnTime[token] = now;
            }
        } else {
            emit WithdrawalFailed(
                from,
                to,
                token,
                uint96(amount)
            );
        }
    }
}
