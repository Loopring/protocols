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
pragma solidity 0.5.2;

import "../../lib/BurnableERC20.sol";
import "../../lib/ERC20SafeTransfer.sol";

import "../../iface/ILoopringV3.sol";

import "./ExchangeAccounts.sol";
import "./ExchangeBalances.sol";
import "./ExchangeData.sol";
import "./ExchangeMode.sol";
import "./ExchangeTokens.sol";


/// @title ExchangeAccounts.
/// @author Daniel Wang  - <daniel@loopring.org>
/// @author Brecht Devos - <brecht@loopring.org>
library ExchangeWithdrawals
{
    using MathUint          for uint;
    using ERC20SafeTransfer for address;
    using ExchangeAccounts  for ExchangeData.State;
    using ExchangeBalances  for ExchangeData.State;
    using ExchangeMode      for ExchangeData.State;
    using ExchangeTokens    for ExchangeData.State;

    event BlockFeeWithdrawn(
        uint32  indexed blockIdx,
        uint            amount
    );

    event WithdrawalRequested(
        uint32  indexed withdrawalIdx,
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

    function getFirstUnprocessedWithdrawalRequestIndex(
        ExchangeData.State storage S
        )
        public
        view
        returns (uint)
    {
        ExchangeData.Block storage currentBlock = S.blocks[S.blocks.length - 1];
        return currentBlock.numWithdrawRequestsCommitted;
    }

    function getNumAvailableWithdrawalSlots(
        ExchangeData.State storage S
        )
        public
        view
        returns (uint)
    {
        uint numOpenRequests = S.withdrawalChain.length - getFirstUnprocessedWithdrawalRequestIndex(S);
        return ExchangeData.MAX_OPEN_REQUESTS() - numOpenRequests;
    }

    function getWithdrawRequest(
        ExchangeData.State storage S,
        uint index
        )
        public
        view
        returns (
            bytes32 accumulatedHash,
            uint256 accumulatedFee,
            uint32 timestamp
        )
    {
        require(index < S.withdrawalChain.length, "INVALID_INDEX");
        ExchangeData.Request storage request = S.withdrawalChain[index];
        accumulatedHash = request.accumulatedHash;
        accumulatedFee = request.accumulatedFee;
        timestamp = request.timestamp;
    }

    // Set the large value for amount to withdraw the complete balance
    function withdraw(
        ExchangeData.State storage S,
        address token,
        uint96 amount
        )
        public
    {
        require(amount > 0, "ZERO_VALUE");
        require(!S.isInWithdrawalMode(), "INVALID_MODE");
        require(now >= S.disableUserRequestsUntil, "USER_REQUEST_SUSPENDED");
        require(getNumAvailableWithdrawalSlots(S) > 0, "TOO_MANY_REQUESTS_OPEN");

        uint16 tokenID = S.getTokenID(token);
        uint24 accountID = S.getAccountID(msg.sender);
        ExchangeData.Account storage account = S.accounts[accountID];

        // Check ETH value sent, can be larger than the expected withdraw fee
        require(msg.value >= S.withdrawalFeeETH, "INVALID_VALUE");
        // Send surplus of ETH back to the sender
        if (msg.value > S.withdrawalFeeETH) {
            msg.sender.transfer(msg.value.sub(S.withdrawalFeeETH));
        }

        // Allow anyone to withdraw from fee accounts
        require(
            ExchangeAccounts.isFeeRecipientAccount(account) || account.owner == msg.sender,
            "UNAUTHORIZED"
        );

        // Add the withdraw to the withdraw chain
        ExchangeData.Request storage prevRequest = S.withdrawalChain[S.withdrawalChain.length - 1];
        ExchangeData.Request memory request = ExchangeData.Request(
            sha256(
                abi.encodePacked(
                    prevRequest.accumulatedHash,
                    accountID,
                    tokenID,
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
    function withdrawFromMerkleTreeFor(
        ExchangeData.State storage S,
        address owner,
        address token,
        uint32  nonce,
        uint96  balance,
        uint256 tradeHistoryRoot,
        uint256[24] memory accountPath,
        uint256[12] memory balancePath
        )
        public
    {
        require(S.isInWithdrawalMode(), "NOT_IN_WITHDRAW_MODE");

        ExchangeData.Block storage lastBlock = S.blocks[S.blocks.length - 1];
        require(lastBlock.state == ExchangeData.BlockState.FINALIZED, "BLOCK_NOT_FINALIZED");

        uint24 accountID = S.getAccountID(owner);
        ExchangeData.Account storage account = S.accounts[accountID];
        uint16 tokenID = S.getTokenID(token);
        require(S.withdrawnInWithdrawMode[owner][token] == false, "WITHDRAWN_ALREADY");

        // TODO(daniel): Stack too deep error if uncomment this.
        // S.verifyAccountBalance(
        //     uint256(lastBlock.merkleRoot),
        //     accountID,
        //     tokenID,
        //     account.pubKeyX,
        //     account.pubKeyY,
        //     nonce,
        //     balance,
        //     tradeHistoryRoot,
        //     accountPath,
        //     balancePath
        // );

        // Make sure the balance can only be withdrawn once
        S.withdrawnInWithdrawMode[owner][token] = true;

        // Transfer the tokens
        withdrawAndBurn(
            S,
            owner,
            tokenID,
            balance,
            ExchangeAccounts.isFeeRecipientAccount(account)
        );
    }

    function withdrawFromDepositRequest(
        ExchangeData.State storage S,
        uint depositRequestIdx
        )
        public
    {
        require(S.isInWithdrawalMode(), "NOT_IN_WITHDRAW_MODE");

        ExchangeData.Block storage lastBlock = S.blocks[S.blocks.length - 1];
        require(lastBlock.state == ExchangeData.BlockState.FINALIZED, "BLOCK_NOT_FINALIZED");

        require (depositRequestIdx < lastBlock.numDepositRequestsCommitted, "REQUEST_COMMITTED_ALREADY");

        ExchangeData.Deposit storage _deposit = S.deposits[depositRequestIdx];

        uint amount = _deposit.amount;
        require(amount > 0, "WITHDRAWN_ALREADY");

        // Set the amount to 0 so it cannot be withdrawn again
        _deposit.amount = 0;

        // Transfer the tokens
        ExchangeData.Account storage account = S.accounts[_deposit.accountID];
        withdrawAndBurn(
            S,
            account.owner,
            _deposit.tokenID,
            amount,
            ExchangeAccounts.isFeeRecipientAccount(account)
        );
    }

    function withdrawFromApprovedWithdrawal(
        ExchangeData.State storage S,
        uint blockIdx,
        uint slotIdx
        )
        public
    {
        // TODO: special case if slotIdx == 0 to search in byte array
        //       (maybe not needed anymore with automatic transferring in normal cases)

        // require(isInWithdrawalMode(), "NOT_IN_WITHDRAW_MODE");

        require(blockIdx < S.blocks.length, "INVALID_BLOCK_IDX");
        ExchangeData.Block storage withdrawBlock = S.blocks[blockIdx];

        // Only allow withdrawing on finalized blocks
        require(withdrawBlock.state == ExchangeData.BlockState.FINALIZED, "BLOCK_NOT_FINALIZED");

        // Get the withdraw data of the given slot
        // TODO: optimize
        bytes memory withdrawals = withdrawBlock.withdrawals;
        uint offset = 4 + 32 + 32 + 3 + 32 + 32 + 4 + 4 + (3 + 2 + 12) * (slotIdx + 1);
        require(offset < withdrawals.length + 32, "INVALID_SLOT_IDX");
        uint data;
        assembly {
            data := mload(add(withdrawals, offset))
        }

        // Extract the data
        uint24 accountID = uint24((data / 0x10000000000000000000000000000) & 0xFFFFFF);
        uint16 tokenID = uint16((data / 0x1000000000000000000000000) & 0xFFFF);
        uint amount = data & 0xFFFFFFFFFFFFFFFFFFFFFFFF;

        ExchangeData.Account storage account = S.accounts[accountID];

        if (amount > 0) {
            // Set the amount to 0 so it cannot be withdrawn anymore
            data = data & 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF000000000000000000000000;
            assembly {
                mstore(add(withdrawals, offset), data)
            }
            withdrawBlock.withdrawals = withdrawals;

            // Transfer the tokens
            withdrawAndBurn(
                S,
                account.owner,
                tokenID,
                amount,
                ExchangeAccounts.isFeeRecipientAccount(account)
            );
        }

        emit WithdrawalCompleted(
            accountID,
            tokenID,
            account.owner,
            uint96(amount)
        );
    }


    function withdrawBlockFee(
        ExchangeData.State storage S,
        uint32 blockIdx
        )
        public
        returns (uint feeAmount)
    {
        // require(msg.sender == exchangeOwner, "UNAUTHORIZED");
        require(blockIdx > 0 && blockIdx < S.blocks.length, "INVALID_BLOCK_IDX");
        ExchangeData.Block storage requestedBlock = S.blocks[blockIdx];
        ExchangeData.Block storage previousBlock = S.blocks[blockIdx - 1];

        require(requestedBlock.state == ExchangeData.BlockState.FINALIZED, "BLOCK_NOT_FINALIZED");
        require(requestedBlock.blockFeeWithdrawn == false, "FEE_WITHDRAWN_ALREADY");

        feeAmount = 0;
        if(requestedBlock.numDepositRequestsCommitted > previousBlock.numDepositRequestsCommitted) {
            feeAmount = S.depositChain[requestedBlock.numDepositRequestsCommitted - 1].accumulatedFee.sub(
                S.depositChain[previousBlock.numDepositRequestsCommitted - 1].accumulatedFee
            );
        } else if(requestedBlock.numWithdrawRequestsCommitted > previousBlock.numWithdrawRequestsCommitted) {
            feeAmount = S.withdrawalChain[requestedBlock.numWithdrawRequestsCommitted - 1].accumulatedFee.sub(
                S.withdrawalChain[previousBlock.numWithdrawRequestsCommitted - 1].accumulatedFee
            );
        } else {
            revert("BLOCK_HAS_NO_OPERATOR_FEE");
        }

        // Make sure it can't be withdrawn again
        requestedBlock.blockFeeWithdrawn = true;

        // Transfer the fee to the operator
        S.operator.transfer(feeAmount);

        emit BlockFeeWithdrawn(blockIdx, feeAmount);

        return feeAmount;
    }

    function distributeWithdrawals(
        ExchangeData.State storage S,
        uint blockIdx
        )
        public
    {
        require(blockIdx < S.blocks.length, "INVALID_BLOCK_IDX");
        ExchangeData.Block storage withdrawBlock = S.blocks[blockIdx];

        // Only allow withdrawing on finalized blocks
        require(withdrawBlock.state == ExchangeData.BlockState.FINALIZED, "BLOCK_NOT_FINALIZED");

        // TODO: Check if transfers still need to be done + do all tranfers + update necessary state
        //       Make sure to zero out this data when done, this will not only make sure it cannot be withdrawn again
        //       it will also save on gas for the operator because he will get a rebate for reverting storage data to 0
        // Maybe we can even allow doing the withdrawals in parts so we don't have a single very large transaction?
        // We should allow the transfer to fail in here, in that case the user could maybe retry manually later?
    }


    // == Internal Functions ==
    function withdrawAndBurn(
        ExchangeData.State storage S,
        address accountOwner,
        uint16 tokenID,
        uint amount,
        bool bBurn
        )
        internal
    {
        address payable owner = address(uint160(accountOwner));
        address token = S.getTokenAddress(tokenID);

        // Calculate how much needs to get burned
        uint amountToBurn = 0;
        uint amountToOwner = 0;
        if (bBurn) {
            uint burnRate = S.loopring.getTokenBurnRate(token);
            amountToBurn = amount.mul(burnRate) / 10000;
            amountToOwner = amount - amountToBurn;
        } else {
            amountToBurn = 0;
            amountToOwner = amount;
        }

        // Increase the burn balance
        if (amountToBurn > 0) {
            if (token == address(0x0)) {
                // ETH
                address payable payableLoopringAddress = address(uint160(address(S.loopring)));
                payableLoopringAddress.transfer(amountToBurn);
            } else if (token == S.lrcAddress) {
                // LRC: burn LRC directly
                require(BurnableERC20(S.lrcAddress).burn(amountToBurn), "BURN_FAILURE");
            } else {
                // ERC20 token (not LRC)
                require(token.safeTransfer(address(S.loopring), amountToBurn), "TRANSFER_FAILURE");
            }
        }

        // Transfer the tokens from the contract to the owner
        if (amountToOwner > 0) {
            if (token == address(0x0)) {
                // ETH
                owner.transfer(amountToOwner);
            } else {
                // ERC20 token
                require(token.safeTransfer(owner, amountToOwner), "TRANSFER_FAILURE");
            }
        }
    }
}