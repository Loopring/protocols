/*

  Copyright 2017 Loopring Project Ltd (Loopring Foundation).

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/
pragma solidity ^0.6.6;
pragma experimental ABIEncoderV2;

import "../../iface/ExchangeData.sol";

import "../../lib/AddressUtil.sol";
import "../../lib/BytesUtil.sol";

import "./ExchangeAccounts.sol";
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
    using ExchangeAccounts  for ExchangeData.State;
    using ExchangeBalances  for ExchangeData.State;
    using ExchangeMode      for ExchangeData.State;
    using ExchangeTokens    for ExchangeData.State;

    event WithdrawalRequested(
        uint24  indexed accountID,
        uint16  indexed tokenID,
        uint96          amount
    );

    event WithdrawalCompleted(
        uint24  indexed accountID,
        uint16  indexed tokenID,
        address         to,
        uint96          amount
    );

    event WithdrawalFailed(
        uint24  indexed accountID,
        uint16  indexed tokenID,
        address         to,
        uint96          amount
    );

    function withdraw(
        ExchangeData.State storage S,
        address owner,
        address token,
        uint96  amount,
        uint24  accountID
        )
        external
    {
        require(amount > 0, "ZERO_VALUE");
        require(!S.isInWithdrawalMode(), "INVALID_MODE");
        require(S.areUserRequestsEnabled(), "USER_REQUEST_SUSPENDED");
        require(S.getNumAvailableForcedSlots() > 0, "TOO_MANY_REQUESTS_OPEN");

        uint16 tokenID = S.getTokenID(token);

        // Check ETH value sent, can be larger than the expected withdraw fee
        require(msg.value >= S.withdrawalFeeETH, "INSUFFICIENT_FEE");

        // Send surplus of ETH back to the sender
        uint feeSurplus = msg.value.sub(S.withdrawalFeeETH);
        if (feeSurplus > 0) {
            msg.sender.sendETHAndVerify(feeSurplus, gasleft());
        }

        require(S.pendingWithdrawals[accountID][tokenID].timestamp == 0, "WITHDRAWAL_ALREADY_PENDING");

        S.pendingWithdrawals[accountID][tokenID].owner = owner;
        S.pendingWithdrawals[accountID][tokenID].amount = amount;
        S.pendingWithdrawals[accountID][tokenID].timestamp = uint32(now);
        S.pendingWithdrawals[accountID][tokenID].fee = uint64(S.withdrawalFeeETH);

        S.numPendingForcedTransactions++;

        emit WithdrawalRequested(
            accountID,
            tokenID,
            amount
        );
    }

    // We still alow anyone to withdraw these funds for the account owner
    function withdrawFromMerkleTree(
        ExchangeData.State storage S,
        uint24   accountID,
        address  owner,
        address  token,
        uint     pubKeyX,
        uint     pubKeyY,
        uint32   nonce,
        uint96   balance,
        uint     tradeHistoryRoot,
        uint[36] calldata accountMerkleProof,
        uint[15] calldata balanceMerkleProof
        )
        external
    {
        require(S.isInWithdrawalMode(), "NOT_IN_WITHDRAW_MODE");

        uint16 tokenID = S.getTokenID(token);
        require(S.withdrawnInWithdrawMode[accountID][tokenID] == false, "WITHDRAWN_ALREADY");

        ExchangeBalances.verifyAccountBalance(
            uint(S.merkleRoot),
            accountID,
            owner,
            tokenID,
            pubKeyX,
            pubKeyY,
            nonce,
            balance,
            tradeHistoryRoot,
            accountMerkleProof,
            balanceMerkleProof
        );

        // Make sure the balance can only be withdrawn once
        S.withdrawnInWithdrawMode[accountID][tokenID] = true;

        // Transfer the tokens
        transferTokens(
            S,
            owner,
            tokenID,
            balance,
            false
        );
    }

    function withdrawFromDepositRequest(
        ExchangeData.State storage S,
        address owner,
        address token
        )
        external
    {
        uint16 tokenID = S.getTokenID(token);
        ExchangeData.Deposit storage deposit = S.pendingDeposits[owner][tokenID];

        // Only allow withdrawing from deposit when the time limit
        // to process it has been exceeded.
        require(deposit.timestamp + ExchangeData.MAX_AGE_DEPOSIT_UNTIL_WITHDRAWABLE() >= now, "DEPOSIT_NOT_WITHDRAWABLE_YET");

        uint amount = deposit.amount;
        uint fee = deposit.fee;

        // Reset the deposit request
        S.pendingDeposits[owner][tokenID] = ExchangeData.Deposit(0, 0, 0);

        // Transfer the tokens
        transferTokens(
            S,
            owner,
            tokenID,
            amount,
            false
        );

        // Return the fee
        owner.sendETHAndVerify(fee, gasleft());
    }

    function withdrawFromApprovedWithdrawal(
        ExchangeData.State storage S,
        address owner,
        address token
        )
        public
    {
        uint16 tokenID = S.getTokenID(token);
        uint amount = S.amountWithdrawable[owner][tokenID];

        // Make sure this amount can't be withdrawn again
        S.amountWithdrawable[owner][tokenID] = 0;

        // Transfer the tokens
        transferTokens(
            S,
            owner,
            tokenID,
            amount,
            false
        );
    }

    function distributeWithdrawal(
        ExchangeData.State storage S,
        address owner,
        uint16 tokenID,
        uint amount
        )
        public
    {
        // Transfer the tokens
        bool success = transferTokens(
            S,
            owner,
            tokenID,
            amount,
            true
        );
        if (!success) {
            // Allow the amount to be withdrawn using `withdrawFromApprovedWithdrawal`.
            S.amountWithdrawable[owner][tokenID] = S.amountWithdrawable[owner][tokenID].add(amount);
        }
    }

    // == Internal and Private Functions ==

    // If allowFailure is true the transfer can fail because of a transfer error or
    // because the transfer uses more than GAS_LIMIT_SEND_TOKENS gas. The function
    // will return true when successful, false otherwise.
    // If allowFailure is false the transfer is guaranteed to succeed using
    // as much gas as needed, otherwise it throws. The function always returns true.
    function transferTokens(
        ExchangeData.State storage S,
        address to,
        uint16  tokenID,
        uint    amount,
        bool    allowFailure
        )
        private
        returns (bool success)
    {
        if (to == address(0)) {
            to = S.loopring.protocolFeeVault();
        }
        address token = S.getTokenAddress(tokenID);
        // Either limit the gas by ExchangeData.GAS_LIMIT_SEND_TOKENS() or forward all gas
        uint gasLimit = allowFailure ? ExchangeData.GAS_LIMIT_SEND_TOKENS() : gasleft();

        // Transfer the tokens from the deposit contract to the owner
        if (amount > 0) {
            try S.depositContract.withdraw{gas: gasLimit}(to, token, amount) {
                success = true;
            } catch Error(string memory /*reason*/) {
                success = false;
            }
        } else {
            success = true;
        }

        if (!allowFailure) {
            require(success, "TRANSFER_FAILURE");
        }

        if (success) {
            emit WithdrawalCompleted(
                0,
                tokenID,
                to,
                uint96(amount)
            );
        } else {
            emit WithdrawalFailed(
                0,
                tokenID,
                to,
                uint96(amount)
            );
        }
    }
}
