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
pragma solidity ^0.5.11;

import "../../lib/AddressUtil.sol";
import "../../lib/BurnableERC20.sol";
import "../../lib/ERC20SafeTransfer.sol";

import "./ExchangeAccounts.sol";
import "./ExchangeBalances.sol";
import "./ExchangeData.sol";
import "./ExchangeMode.sol";
import "./ExchangeTokens.sol";


/// @title ExchangeWithdrawals.
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
library ExchangeWithdrawals
{
    using AddressUtil       for address;
    using AddressUtil       for address payable;
    using MathUint          for uint;
    using ERC20SafeTransfer for address;
    using ExchangeAccounts  for ExchangeData.State;
    using ExchangeBalances  for ExchangeData.State;
    using ExchangeMode      for ExchangeData.State;
    using ExchangeTokens    for ExchangeData.State;

    event BlockFeeWithdrawn(
        uint    indexed blockIdx,
        uint            amount
    );

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
                    uint8(tokenID),
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
        address  owner,
        address  token,
        uint     pubKeyX,
        uint     pubKeyY,
        uint32   nonce,
        uint96   balance,
        uint     tradeHistoryRoot,
        uint[30] calldata accountMerkleProof,
        uint[12] calldata balanceMerkleProof
        )
        external
    {
        require(S.isInWithdrawalMode(), "NOT_IN_WITHDRAW_MODE");

        ExchangeData.Block storage lastFinalizedBlock = S.blocks[S.numBlocksFinalized - 1];

        uint24 accountID = S.getAccountID(owner);
        uint16 tokenID = S.getTokenID(token);
        require(S.withdrawnInWithdrawMode[owner][token] == false, "WITHDRAWN_ALREADY");

        ExchangeBalances.verifyAccountBalance(
            uint(lastFinalizedBlock.merkleRoot),
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
        ExchangeData.Block storage currentBlock = S.blocks[S.blocks.length - 1];
        return currentBlock.numWithdrawalRequestsCommitted;
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

        ExchangeData.Block storage lastFinalizedBlock = S.blocks[S.numBlocksFinalized - 1];
        require(depositIdx >= lastFinalizedBlock.numDepositRequestsCommitted, "REQUEST_INCLUDED_IN_FINALIZED_BLOCK");

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
        uint blockIdx,
        ExchangeData.Block storage withdrawBlock,
        uint slotIdx,
        bool allowFailure
        )
        public
        returns (bool success)
    {
        require(slotIdx < withdrawBlock.blockSize, "INVALID_SLOT_IDX");
        // Only allow withdrawing on finalized blocks
        require(blockIdx < S.numBlocksFinalized, "BLOCK_NOT_FINALIZED");

        // Get the withdrawal data from storage for the given slot
        uint[] memory slice = new uint[](2);
        uint slot = (7 * slotIdx) / 32;
        uint offset = (7 * (slotIdx + 1)) - (slot * 32);
        uint sc = 0;
        uint data = 0;
        // Short byte arrays (length <= 31) are stored differently in storage
        if (withdrawBlock.withdrawals.length >= 32) {
            bytes storage withdrawals = withdrawBlock.withdrawals;
            uint dataSlot1 = 0;
            uint dataSlot2 = 0;
            assembly {
                // keccak hash to get the contents of the array
                mstore(0x0, withdrawals_slot)
                sc := keccak256(0x0, 0x20)
                dataSlot1 := sload(add(sc, slot))
                dataSlot2 := sload(add(sc, add(slot, 1)))
            }
            // Stitch the data together so we can extract the data in a single uint
            // (withdrawal data is at the LSBs)
            slice[0] = dataSlot1;
            slice[1] = dataSlot2;
            assembly {
                data := mload(add(slice, offset))
            }
        } else {
            bytes memory mWithdrawals = withdrawBlock.withdrawals;
            assembly {
                data := mload(add(mWithdrawals, offset))
            }
        }

        // Extract the withdrawal data
        uint16 tokenID = uint16((data >> 48) & 0xFF);
        uint24 accountID = uint24((data >> 28) & 0xFFFFF);
        uint amount = (data & 0xFFFFFFF).decodeFloat();

        // Transfer the tokens
        success = transferTokens(
            S,
            accountID,
            tokenID,
            amount,
            allowFailure
        );

        if (success && amount > 0) {
            // Set everything to 0 for this withdrawal so it cannot be used anymore
            data = data & uint(~((1 << (7 * 8)) - 1));

            // Update the data in storage
            if (withdrawBlock.withdrawals.length >= 32) {
                assembly {
                    mstore(add(slice, offset), data)
                }
                uint dataSlot1 = slice[0];
                uint dataSlot2 = slice[1];
                assembly {
                    sstore(add(sc, slot), dataSlot1)
                    sstore(add(sc, add(slot, 1)), dataSlot2)
                }
            } else {
                bytes memory mWithdrawals = withdrawBlock.withdrawals;
                assembly {
                    mstore(add(mWithdrawals, offset), data)
                }
                withdrawBlock.withdrawals = mWithdrawals;
            }
        }
    }

    function withdrawBlockFee(
        ExchangeData.State storage S,
        uint blockIdx,
        address payable feeRecipient
        )
        external
        returns (uint feeAmountToOperator)
    {
        require(blockIdx > 0 && blockIdx < S.blocks.length, "INVALID_BLOCK_IDX");
        ExchangeData.Block storage requestedBlock = S.blocks[blockIdx];
        ExchangeData.Block storage previousBlock = S.blocks[blockIdx - 1];

        require(blockIdx < S.numBlocksFinalized, "BLOCK_NOT_FINALIZED");
        require(requestedBlock.blockFeeWithdrawn == false, "FEE_WITHDRAWN_ALREADY");

        uint feeAmount = 0;
        uint32 lastRequestTimestamp = 0;
        {
        uint startIndex = previousBlock.numDepositRequestsCommitted;
        uint endIndex = requestedBlock.numDepositRequestsCommitted;
        if(endIndex > startIndex) {
            feeAmount = S.depositChain[endIndex - 1].accumulatedFee.sub(
                S.depositChain[startIndex - 1].accumulatedFee
            );
            lastRequestTimestamp = S.depositChain[endIndex - 1].timestamp;
        } else {
            startIndex = previousBlock.numWithdrawalRequestsCommitted;
            endIndex = requestedBlock.numWithdrawalRequestsCommitted;

            if(endIndex > startIndex) {
                feeAmount = S.withdrawalChain[endIndex - 1].accumulatedFee.sub(
                    S.withdrawalChain[startIndex - 1].accumulatedFee
                );
                lastRequestTimestamp = S.withdrawalChain[endIndex - 1].timestamp;
            } else {
                revert("BLOCK_HAS_NO_OPERATOR_FEE");
            }
        }
        }

        // Calculate how much of the fee the operator gets for the block
        // If there are many requests than lastRequestTimestamp ~= firstRequestTimestamp so
        // all requests will need to be done in FEE_BLOCK_FINE_START_TIME minutes to get the complete fee.
        // If there are very few requests than lastRequestTimestamp >> firstRequestTimestamp and we don't want
        // to fine the operator for waiting until he can fill a complete block.
        // This is why we use the timestamp of the last request included in the block.
        uint32 blockTimestamp = requestedBlock.timestamp;
        uint32 startTime = lastRequestTimestamp + ExchangeData.FEE_BLOCK_FINE_START_TIME();
        uint fine = 0;
        if (blockTimestamp > startTime) {
            fine = feeAmount.mul(blockTimestamp - startTime) / ExchangeData.FEE_BLOCK_FINE_MAX_DURATION();
        }
        uint feeAmountToBurn = (fine > feeAmount) ? feeAmount : fine;
        feeAmountToOperator = feeAmount - feeAmountToBurn;

        // Make sure it can't be withdrawn again
        requestedBlock.blockFeeWithdrawn = true;

        // Burn part of the fee by sending it to the protocol fee manager
        S.loopring.protocolFeeVault().sendETHAndVerify(feeAmountToBurn, gasleft());
        // Transfer the fee to the operator
        feeRecipient.sendETHAndVerify(feeAmountToOperator, gasleft());

        emit BlockFeeWithdrawn(blockIdx, feeAmount);
    }

    function distributeWithdrawals(
        ExchangeData.State storage S,
        uint blockIdx,
        uint maxNumWithdrawals
        )
        external
    {
        require(blockIdx < S.blocks.length, "INVALID_BLOCK_IDX");
        require(maxNumWithdrawals > 0, "INVALID_MAX_NUM_WITHDRAWALS");
        ExchangeData.Block storage withdrawBlock = S.blocks[blockIdx];

        // Check if this is a withdrawal block
        require(
            withdrawBlock.blockType == ExchangeData.BlockType.ONCHAIN_WITHDRAWAL ||
            withdrawBlock.blockType == ExchangeData.BlockType.OFFCHAIN_WITHDRAWAL,
            "INVALID_BLOCK_TYPE"
        );

        // Only allow withdrawing on finalized blocks
        require(blockIdx < S.numBlocksFinalized, "BLOCK_NOT_FINALIZED");
        // Check if the withdrawals were already completely distributed
        require(withdrawBlock.numWithdrawalsDistributed < withdrawBlock.blockSize, "WITHDRAWALS_ALREADY_DISTRIBUTED");

        // Only allow the operator to distribute withdrawals at first, if he doesn't do it in time
        // anyone can do it and get paid a part of the exchange stake
        bool bOnlyOperator = now < withdrawBlock.timestamp + ExchangeData.MAX_TIME_TO_DISTRIBUTE_WITHDRAWALS();
        if (bOnlyOperator) {
            require(msg.sender == S.operator, "UNAUTHORIZED");
        }

        // Calculate the range of withdrawals we'll do
        uint start = withdrawBlock.numWithdrawalsDistributed;
        uint end = start.add(maxNumWithdrawals);
        if (end > withdrawBlock.blockSize) {
            end = withdrawBlock.blockSize;
        }

        // Do the withdrawals
        uint gasLimit = ExchangeData.MIN_GAS_TO_DISTRIBUTE_WITHDRAWALS();
        uint totalNumWithdrawn = start;
        while (totalNumWithdrawn < end && gasleft() >= gasLimit) {
            // Don't check the return value here, the withdrawal is allowed to fail.
            // The automatic token disribution by the operator is a best effort only.
            // The account owner can always manually withdraw without any limits.
            withdrawFromApprovedWithdrawal(
                S,
                blockIdx,
                withdrawBlock,
                totalNumWithdrawn,
                true
            );
            totalNumWithdrawn++;
        }
        withdrawBlock.numWithdrawalsDistributed = uint16(totalNumWithdrawn);

        // Fine the exchange if the withdrawals are done too late
        if (!bOnlyOperator) {
            // We use the stake of the exchange to punish withdrawals that are distributed too late
            uint numWithdrawn = totalNumWithdrawn.sub(start);
            uint totalFine = S.loopring.withdrawalFineLRC().mul(numWithdrawn);
            // Burn 50% of the fine, reward the distributer the rest
            uint amountToBurn = totalFine / 2;
            uint amountToDistributer = totalFine - amountToBurn;
            S.loopring.burnExchangeStake(S.id, amountToBurn);
            S.loopring.withdrawExchangeStake(S.id, msg.sender, amountToDistributer);
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
        uint24  accountID,
        uint16  tokenID,
        uint    amount,
        bool    allowFailure
        )
        private
        returns (bool success)
    {
        // If we're withdrawing from the protocol fee account send the tokens
        // directly to the protocol fee vault.
        // If we're withdrawing to an unknown account (can currently happen while
        // distributing tokens in shutdown) send the tokens to the protocol fee vault as well.
        address to;
        if (accountID == 0 || accountID >= S.accounts.length) {
            to = S.loopring.protocolFeeVault();
        } else {
            to = S.accounts[accountID].owner;
        }

        address token = S.getTokenAddress(tokenID);
        // Either limit the gas by ExchangeData.GAS_LIMIT_SEND_TOKENS() or forward all gas
        uint gasLimit = allowFailure ? ExchangeData.GAS_LIMIT_SEND_TOKENS() : gasleft();

        // Transfer the tokens from the contract to the owner
        if (amount > 0) {
            if (token == address(0)) {
                // ETH
                success = to.sendETH(amount, gasLimit);
            } else {
                // ERC20 token
                success = token.safeTransferWithGasLimit(to, amount, gasLimit);
            }
        } else {
            success = true;
        }

        if (!allowFailure) {
            require(success, "TRANSFER_FAILURE");
        }

        if (success) {
            if (amount > 0) {
                S.tokenBalances[token] = S.tokenBalances[token].sub(amount);
            }

            if (accountID > 0 || tokenID > 0 || amount > 0) {
                // Only emit an event when the withdrawal data hasn't been reset yet
                // by a previous successful withdrawal
                emit WithdrawalCompleted(
                    accountID,
                    tokenID,
                    to,
                    uint96(amount)
                );
            }
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
