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
        require(msg.value >= S.withdrawalFeeETH, "INSUFFICIENT_FEE");
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
        uint256[20] memory accountPath,
        uint256[8] memory balancePath
        )
        public
    {
        require(S.isInWithdrawalMode(), "NOT_IN_WITHDRAW_MODE");

        ExchangeData.Block storage lastFinalizedBlock = S.blocks[S.numBlocksFinalized - 1];
        assert(lastFinalizedBlock.state == ExchangeData.BlockState.FINALIZED);

        uint24 accountID = S.getAccountID(owner);
        ExchangeData.Account storage account = S.accounts[accountID];
        uint16 tokenID = S.getTokenID(token);
        require(S.withdrawnInWithdrawMode[owner][token] == false, "WITHDRAWN_ALREADY");

        ExchangeBalances.verifyAccountBalance(
            uint256(lastFinalizedBlock.merkleRoot),
            accountID,
            tokenID,
            account.pubKeyX,
            account.pubKeyY,
            nonce,
            balance,
            tradeHistoryRoot,
            accountPath,
            balancePath
        );

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

        ExchangeData.Block storage lastFinalizedBlock = S.blocks[S.numBlocksFinalized - 1];
        assert(lastFinalizedBlock.state == ExchangeData.BlockState.FINALIZED);

        require(depositRequestIdx >= lastFinalizedBlock.numDepositRequestsCommitted, "REQUEST_INCLUDED_IN_FINALIZED_BLOCK");

        // The deposit info is stored at depositRequestIdx - 1
        ExchangeData.Deposit storage _deposit = S.deposits[depositRequestIdx.sub(1)];

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
        require(blockIdx < S.blocks.length, "INVALID_BLOCK_IDX");
        ExchangeData.Block storage withdrawBlock = S.blocks[blockIdx];

        // Only allow withdrawing on finalized blocks
        require(withdrawBlock.state == ExchangeData.BlockState.FINALIZED, "BLOCK_NOT_FINALIZED");

        // Get the withdraw data of the given slot
        // TODO(brecht): optimize SLOAD/SSTORE of bytes in storage
        bytes memory withdrawals = withdrawBlock.withdrawals;
        uint offset = (3 + 2 + 12) * (slotIdx + 1);
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

            emit WithdrawalCompleted(
                accountID,
                tokenID,
                account.owner,
                uint96(amount)
            );
        }
    }


    function withdrawBlockFee(
        ExchangeData.State storage S,
        uint32 blockIdx
        )
        public
        returns (uint feeAmountToOperator)
    {
        require(blockIdx > 0 && blockIdx < S.blocks.length, "INVALID_BLOCK_IDX");
        ExchangeData.Block storage requestedBlock = S.blocks[blockIdx];
        ExchangeData.Block storage previousBlock = S.blocks[blockIdx - 1];

        require(requestedBlock.state == ExchangeData.BlockState.FINALIZED, "BLOCK_NOT_FINALIZED");
        require(requestedBlock.blockFeeWithdrawn == false, "FEE_WITHDRAWN_ALREADY");

        uint feeAmount = 0;
        uint32 lastRequestTimestamp = 0;
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

        // Burn part of the fee by sending it to the loopring contract
        if (feeAmountToBurn > 0) {
            address payable payableLoopringAddress = address(uint160(address(S.loopring)));
            payableLoopringAddress.transfer(feeAmountToBurn);
        }
        // Transfer the fee to the operator
        if (feeAmountToOperator > 0) {
            S.operator.transfer(feeAmountToOperator);
        }

        emit BlockFeeWithdrawn(blockIdx, feeAmount);
    }

    function distributeWithdrawals(
        ExchangeData.State storage S,
        uint blockIdx
        )
        public
    {
        require(blockIdx < S.blocks.length, "INVALID_BLOCK_IDX");
        ExchangeData.Block storage withdrawBlock = S.blocks[blockIdx];

        // Check if this is a withdraw block
        require(withdrawBlock.blockType == uint8(ExchangeData.BlockType.ONCHAIN_WITHDRAWAL) ||
                withdrawBlock.blockType == uint8(ExchangeData.BlockType.OFFCHAIN_WITHDRAWAL), "INVALID_BLOCK_TYPE");
        // Only allow withdrawing on finalized blocks
        require(withdrawBlock.state == ExchangeData.BlockState.FINALIZED, "BLOCK_NOT_FINALIZED");
        // Check if the witdrawals were already completely distributed
        require(withdrawBlock.numWithdrawalsDistributed < withdrawBlock.numElements, "WITHDRAWALS_ALREADY_DISTRIBUTED");

        // Only allow the operator to distibute withdrawals at first, if he doesn't do it in time
        // anyone can do it and get paid a part of the operator stake
        if (now < withdrawBlock.timestamp + ExchangeData.MAX_TIME_TO_DISTRIBUTE_WITHDRAWALS()) {
            require(msg.sender == S.operator, "UNAUTHORIZED");
        } else {
            // We use the stake of the exchange to punish withdrawals that are distributed too late
            uint totalFine = S.loopring.withdrawalFineLRC().mul(withdrawBlock.numElements);
            // Burn 50% of the fine, reward the distributer the rest
            uint amountToBurn = totalFine / 2;
            uint amountToDistributer = totalFine - amountToBurn;
            S.loopring.burnStake(S.id, amountToBurn);
            S.loopring.withdrawStakeTo(S.id, msg.sender, amountToDistributer);
        }

        // Possible enhancement: allow withdrawing in parts
        for (uint i = 0; i < withdrawBlock.numElements; i++) {
            withdrawFromApprovedWithdrawal(S, blockIdx, i);
        }

        withdrawBlock.numWithdrawalsDistributed = withdrawBlock.numElements;
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