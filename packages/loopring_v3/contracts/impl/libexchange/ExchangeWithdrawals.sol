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
        uint    indexed withdrawalIdx,
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

    function getWithdrawRequest(
        ExchangeData.State storage S,
        uint index
        )
        external
        view
        returns (
            bytes32 accumulatedHash,
            uint    accumulatedFee,
            uint32  timestamp
        )
    {
        require(index < S.withdrawalChain.length, "INVALID_INDEX");
        ExchangeData.Request storage request = S.withdrawalChain[index];
        accumulatedHash = request.accumulatedHash;
        accumulatedFee = request.accumulatedFee;
        timestamp = request.timestamp;
    }

    function withdraw(
        ExchangeData.State storage S,
        uint24  accountID,
        address token,
        uint96  amount
        )
        external
    {
        require(amount > 0, "ZERO_VALUE");
        require(!S.isInWithdrawalMode(), "INVALID_MODE");
        require(S.areUserRequestsEnabled(), "USER_REQUEST_SUSPENDED");
        require(getNumAvailableWithdrawalSlots(S) > 0, "TOO_MANY_REQUESTS_OPEN");

        uint16 tokenID = S.getTokenID(token);

        // Check ETH value sent, can be larger than the expected withdraw fee
        require(msg.value >= S.withdrawalFeeETH, "INSUFFICIENT_FEE");

        // Send surplus of ETH back to the sender
        uint feeSurplus = msg.value.sub(S.withdrawalFeeETH);
        if (feeSurplus > 0) {
            msg.sender.sendETHAndVerify(feeSurplus, gasleft());
        }

        // Add the withdraw to the withdraw chain
        ExchangeData.Request storage prevRequest = S.withdrawalChain[S.withdrawalChain.length - 1];
        ExchangeData.Request memory request = ExchangeData.Request(
            sha256(
                abi.encodePacked(
                    prevRequest.accumulatedHash,
                    accountID,
                    uint16(tokenID),
                    amount
                )
            ),
            prevRequest.accumulatedFee.add(S.withdrawalFeeETH),
            uint32(now)
        );
        S.withdrawalChain.push(request);

        emit WithdrawalRequested(
            uint32(S.withdrawalChain.length - 1),
            accountID,
            tokenID,
            amount
        );
    }

    // We still alow anyone to withdraw these funds for the account owner
    function withdrawFromMerkleTree(
        ExchangeData.State storage S,
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

        uint24 accountID = S.getAccountID(owner);
        uint16 tokenID = S.getTokenID(token);
        require(S.withdrawnInWithdrawMode[owner][token] == false, "WITHDRAWN_ALREADY");

        ExchangeBalances.verifyAccountBalance(
            uint(S.merkleRoot),
            accountID,
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
        S.withdrawnInWithdrawMode[owner][token] = true;

        // Transfer the tokens
        transferTokens(
            S,
            accountID,
            tokenID,
            balance,
            false
        );
    }

    function getNumWithdrawalRequestsProcessed(
        ExchangeData.State storage S
        )
        public
        view
        returns (uint)
    {
        return S.numWithdrawalRequestsCommitted;
    }

    function getNumAvailableWithdrawalSlots(
        ExchangeData.State storage S
        )
        public
        view
        returns (uint)
    {
        uint numOpenRequests = S.withdrawalChain.length - getNumWithdrawalRequestsProcessed(S);
        return ExchangeData.MAX_OPEN_WITHDRAWAL_REQUESTS() - numOpenRequests;
    }

    function withdrawFromDepositRequest(
        ExchangeData.State storage S,
        uint depositIdx
        )
        external
    {
        require(S.isInWithdrawalMode(), "NOT_IN_WITHDRAW_MODE");

        require(depositIdx >= S.numDepositRequestsCommitted, "REQUEST_INCLUDED_IN_BLOCK");

        // The deposit info is stored at depositIdx - 1
        ExchangeData.Deposit storage _deposit = S.deposits[depositIdx.sub(1)];

        uint amount = _deposit.amount;
        require(amount > 0, "WITHDRAWN_ALREADY");

        // Set the amount to 0 so it cannot be withdrawn again
        _deposit.amount = 0;

        // Transfer the tokens
        transferTokens(
            S,
            _deposit.accountID,
            _deposit.tokenID,
            amount,
            false
        );
    }

    function withdrawFromApprovedWithdrawal(
        ExchangeData.State storage S,
        address owner,
        address token
        )
        public
    {
        uint24 accountID = (owner != address(0)) ? S.getAccountID(owner) : 0;
        uint16 tokenID = S.getTokenID(token);
        uint amount = S.amountWithdrawable[accountID][tokenID];

        // Make sure this amount can't be withdrawn again
        S.amountWithdrawable[accountID][tokenID] = 0;

        // Transfer the tokens
        transferTokens(
            S,
            accountID,
            tokenID,
            amount,
            false
        );
    }

    function distributeWithdrawals(
        ExchangeData.State storage S,
        bytes memory withdrawals
        )
        public
    {
        for (uint i = 0; i < withdrawals.length; i += 8) {
            uint data = uint(withdrawals.bytesToUint64(i));

            // Extract the withdrawal data
            uint16 tokenID = uint16((data >> 48) & 0xFFFF);
            uint24 accountID = uint24((data >> 24) & 0xFFFFFF);
            uint amount = (data & 0xFFFFFF).decodeFloat(24);

            // Transfer the tokens
            bool success = transferTokens(
                S,
                accountID,
                tokenID,
                amount,
                true
            );
            if (!success) {
                // Allow the amount to be withdrawn using `withdrawFromApprovedWithdrawal`.
                S.amountWithdrawable[accountID][tokenID] = S.amountWithdrawable[accountID][tokenID].add(amount);
            }
        }
    }

    // == Internal and Private Functions ==

    function getOwner(
        ExchangeData.State storage S,
        uint24 accountID
        )
        private
        view
        returns (address addr)
    {
        // If we're withdrawing from the protocol fee account send the tokens
        // directly to the protocol fee vault.
        // If we're withdrawing to an unknown account (can currently happen while
        // distributing tokens in shutdown) send the tokens to the protocol fee vault as well.
        if (accountID == 0 || accountID >= S.accounts.length) {
            addr = S.loopring.protocolFeeVault();
        } else {
            addr = S.accounts[accountID].owner;
        }
    }

    // If allowFailure is true the transfer can fail because of a transfer error or
    // because the transfer uses more than GAS_LIMIT_SEND_TOKENS gas. The function
    // will return true when successful, false otherwise.
    // If allowFailure is false the transfer is guaranteed to succeed using
    // as much gas as needed, otherwise it throws. The function always returns true.
    function transferTokens(
        ExchangeData.State storage S,
        uint24  accountID,
        uint16  tokenID,
        uint    amount,
        bool    allowFailure
        )
        private
        returns (bool success)
    {
        address to = getOwner(S, accountID);
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
                accountID,
                tokenID,
                to,
                uint96(amount)
            );
        } else {
            emit WithdrawalFailed(
                accountID,
                tokenID,
                to,
                uint96(amount)
            );
        }
    }
}
