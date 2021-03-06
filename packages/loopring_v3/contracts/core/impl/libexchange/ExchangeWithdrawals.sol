// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../../lib/AddressUtil.sol";
import "../../../thirdparty/BytesUtil.sol";
import "../../iface/ExchangeData.sol";
import "./ExchangeBalances.sol";
import "./ExchangeMode.sol";
import "./ExchangeTokens.sol";


/// @title ExchangeWithdrawals.
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
library ExchangeWithdrawals
{
    enum WithdrawalCategory
    {
        DISTRIBUTION,
        FROM_MERKLE_TREE,
        FROM_DEPOSIT_REQUEST,
        FROM_APPROVED_WITHDRAWAL
    }

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
        uint32  accountID
    );

    event WithdrawalCompleted(
        uint8   category,
        address from,
        address to,
        address token,
        uint    amount
    );

    event WithdrawalFailed(
        uint8   category,
        address from,
        address to,
        address token,
        uint    amount
    );

    function forceWithdraw(
        ExchangeData.State storage S,
        address owner,
        address token,
        uint32  accountID
        )
        public
    {
        require(!S.isInWithdrawalMode(), "INVALID_MODE");
        // Limit the amount of pending forced withdrawals so that the owner cannot be overwhelmed.
        require(S.getNumAvailableForcedSlots() > 0, "TOO_MANY_REQUESTS_OPEN");
        require(accountID < ExchangeData.MAX_NUM_ACCOUNTS, "INVALID_ACCOUNTID");

        uint16 tokenID = S.getTokenID(token);

        // A user needs to pay a fixed ETH withdrawal fee, set by the protocol.
        uint withdrawalFeeETH = S.loopring.forcedWithdrawalFee();

        // Check ETH value sent, can be larger than the expected withdraw fee
        require(msg.value >= withdrawalFeeETH, "INSUFFICIENT_FEE");

        // Send surplus of ETH back to the sender
        uint feeSurplus = msg.value.sub(withdrawalFeeETH);
        if (feeSurplus > 0) {
            msg.sender.sendETHAndVerify(feeSurplus, gasleft());
        }

        // There can only be a single forced withdrawal per (account, token) pair.
        require(
            S.pendingForcedWithdrawals[accountID][tokenID].timestamp == 0,
            "WITHDRAWAL_ALREADY_PENDING"
        );

        // Store the forced withdrawal request data
        S.pendingForcedWithdrawals[accountID][tokenID] = ExchangeData.ForcedWithdrawal({
            owner: owner,
            timestamp: uint64(block.timestamp)
        });

        // Increment the number of pending forced transactions so we can keep count.
        S.numPendingForcedTransactions++;

        emit ForcedWithdrawalRequested(
            owner,
            token,
            accountID
        );
    }

    // We alow anyone to withdraw these funds for the account owner
    function withdrawFromMerkleTree(
        ExchangeData.State       storage S,
        ExchangeData.MerkleProof calldata merkleProof
        )
        public
    {
        require(S.isInWithdrawalMode(), "NOT_IN_WITHDRAW_MODE");

        address owner = merkleProof.accountLeaf.owner;
        uint32 accountID = merkleProof.accountLeaf.accountID;
        uint16 tokenID = merkleProof.balanceLeaf.tokenID;
        uint96 balance = merkleProof.balanceLeaf.balance;

        // Make sure the funds aren't withdrawn already.
        require(S.withdrawnInWithdrawMode[accountID][tokenID] == false, "WITHDRAWN_ALREADY");

        // Verify that the provided Merkle tree data is valid by using the Merkle proof.
        ExchangeBalances.verifyAccountBalance(
            uint(S.merkleRoot),
            merkleProof
        );

        // Make sure the balance can only be withdrawn once
        S.withdrawnInWithdrawMode[accountID][tokenID] = true;

        // Transfer the tokens to the account owner
        transferTokens(
            S,
            uint8(WithdrawalCategory.FROM_MERKLE_TREE),
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
        address token
        )
        public
    {
        uint16 tokenID = S.getTokenID(token);
        ExchangeData.Deposit storage deposit = S.pendingDeposits[owner][tokenID];
        require(deposit.timestamp != 0, "DEPOSIT_NOT_WITHDRAWABLE_YET");

        // Check if the deposit has indeed exceeded the time limit of if the exchange is in withdrawal mode
        require(
            block.timestamp >= deposit.timestamp + S.maxAgeDepositUntilWithdrawable ||
            S.isInWithdrawalMode(),
            "DEPOSIT_NOT_WITHDRAWABLE_YET"
        );

        uint amount = deposit.amount;

        // Reset the deposit request
        delete S.pendingDeposits[owner][tokenID];

        // Transfer the tokens
        transferTokens(
            S,
            uint8(WithdrawalCategory.FROM_DEPOSIT_REQUEST),
            owner,
            owner,
            tokenID,
            amount,
            new bytes(0),
            gasleft(),
            false
        );
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
            delete S.amountWithdrawable[owner][tokenID];

            // Transfer the tokens to the owner
            transferTokens(
                S,
                uint8(WithdrawalCategory.FROM_APPROVED_WITHDRAWAL),
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
        bytes   memory extraData,
        uint    gasLimit
        )
        public
    {
        // Try to transfer the tokens
        bool success = transferTokens(
            S,
            uint8(WithdrawalCategory.DISTRIBUTION),
            from,
            to,
            tokenID,
            amount,
            extraData,
            gasLimit,
            true
        );
        // If the transfer was successful there's nothing left to do.
        // However, if the transfer failed the tokens are still in the contract and can be
        // withdrawn later to `to` by anyone by using `withdrawFromApprovedWithdrawal.
        if (!success) {
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
        uint8   category,
        address from,
        address to,
        uint16  tokenID,
        uint    amount,
        bytes   memory extraData,
        uint    gasLimit,
        bool    allowFailure
        )
        private
        returns (bool success)
    {
        // Redirect withdrawals to address(0) to the protocol fee vault
        if (to == address(0)) {
            to = S.loopring.protocolFeeVault();
        }
        address token = S.getTokenAddress(tokenID);

        // Transfer the tokens from the deposit contract to the owner
        if (gasLimit > 0) {
            try S.depositContract.withdraw{gas: gasLimit}(from, to, token, amount, extraData) {
                success = true;
            } catch {
                success = false;
            }
        } else {
            success = false;
        }

        require(allowFailure || success, "TRANSFER_FAILURE");

        if (success) {
            emit WithdrawalCompleted(category, from, to, token, amount);

            // Keep track of when the protocol fees were last withdrawn
            // (only done to make this data easier available).
            if (from == address(0)) {
                S.protocolFeeLastWithdrawnTime[token] = block.timestamp;
            }
        } else {
            emit WithdrawalFailed(category, from, to, token, amount);
        }
    }
}
