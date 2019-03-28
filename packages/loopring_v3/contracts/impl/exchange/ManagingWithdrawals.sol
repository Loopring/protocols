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

import "../../iface/exchange/IManagingWithdrawals.sol";

import "./ManagingDeposits.sol";


/// @title An Implementation of IDEX.
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
contract ManagingWithdrawals is IManagingWithdrawals, ManagingDeposits
{
    function getFirstUnprocessedWithdrawalRequestIndex()
        public
        view
        returns (uint)
    {
        Block storage currentBlock = blocks[blocks.length - 1];
        return currentBlock.numWithdrawRequestsCommitted;
    }

    function getNumAvailableWithdrawalSlots()
        public
        view
        returns (uint)
    {
        uint numOpenRequests = withdrawalChain.length - getFirstUnprocessedWithdrawalRequestIndex();
        return MAX_OPEN_REQUESTS - numOpenRequests;
    }

    function getWithdrawRequest(
        uint index
        )
        external
        view
        returns (
            bytes32 accumulatedHash,
            uint256 accumulatedFee,
            uint32 timestamp
        )
    {
        require(index < withdrawalChain.length, "INVALID_INDEX");
        Request storage request = withdrawalChain[index];
        accumulatedHash = request.accumulatedHash;
        accumulatedFee = request.accumulatedFee;
        timestamp = request.timestamp;
    }

    // Set the large value for amount to withdraw the complete balance
    function withdraw(
        address token,
        uint96 amount
        )
        external
        payable
    {
        require(amount > 0, "ZERO_VALUE");
        require(!isInWithdrawalMode(), "INVALID_MODE");
        require(now >= disableUserRequestsUntil, "USER_REQUEST_SUSPENDED");
        require(getNumAvailableWithdrawalSlots() > 0, "TOO_MANY_REQUESTS_OPEN");

        uint16 tokenID = getTokenID(token);
        uint24 accountID = getAccountID(msg.sender);
        Account storage account = accounts[accountID];

        // Check ETH value sent, can be larger than the expected withdraw fee
        require(msg.value >= withdrawalFeeETH, "INVALID_VALUE");
        // Send surplus of ETH back to the sender
        if (msg.value > withdrawalFeeETH) {
            msg.sender.transfer(msg.value.sub(withdrawalFeeETH));
        }

        // Allow anyone to withdraw from fee accounts
        require(isFeeRecipientAccount(account) || account.owner == msg.sender, "UNAUTHORIZED");

        // Add the withdraw to the withdraw chain
        Request storage prevRequest = withdrawalChain[withdrawalChain.length - 1];
        Request memory request = Request(
            sha256(
                abi.encodePacked(
                    prevRequest.accumulatedHash,
                    accountID,
                    tokenID,
                    amount
                )
            ),
            prevRequest.accumulatedFee.add(withdrawalFeeETH),
            uint32(now)
        );
        withdrawalChain.push(request);

        emit WithdrawalRequested(
            uint32(withdrawalChain.length - 1),
            accountID,
            tokenID,
            amount
        );
    }

/*
    function withdrawFromMerkleTree(
        address token,
        uint32  nonce,
        uint96  balance,
        uint256 tradeHistoryRoot,
        uint256[24] calldata accountPath,
        uint256[12] calldata balancePath
        )
        external
    {
        withdrawFromMerkleTreeFor(
            msg.sender,
            token,
            nonce,
            balance,
            tradeHistoryRoot,
            accountPath,
            balancePath
        );
    }

    // We still alow anyone to withdraw these funds for the account owner
    function withdrawFromMerkleTreeFor(
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
        require(isInWithdrawalMode(), "NOT_IN_WITHDRAW_MODE");

        Block storage lastBlock = blocks[blocks.length - 1];
        require(lastBlock.state == BlockState.FINALIZED, "BLOCK_NOT_FINALIZED");

        uint24 accountID = getAccountID(owner);
        Account storage account = accounts[accountID];
        uint16 tokenID = getTokenID(token);
        require(withdrawnInWithdrawMode[account.owner][token] == false, "WITHDRAWN_ALREADY");

        verifyAccountBalance(
            lastBlock.merkleRoot,
            accountID,
            tokenID,
            accountPath,
            balancePath,
            account,
            nonce,
            balance,
            tradeHistoryRoot
        );

        // Make sure the balance can only be withdrawn once
        withdrawnInWithdrawMode[owner][token] = true;

        // Transfer the tokens
        withdrawAndBurn(owner, tokenID, balance, isFeeRecipientAccount(account));
    }

     function withdrawFromDepositRequest(
        uint depositRequestIdx
        )
        external
    {
        require(isInWithdrawalMode(), "NOT_IN_WITHDRAW_MODE");

        Block storage lastBlock = blocks[blocks.length - 1];
        require(lastBlock.state == BlockState.FINALIZED, "BLOCK_NOT_FINALIZED");

        require (depositRequestIdx < lastBlock.numDepositRequestsCommitted, "REQUEST_COMMITTED_ALREADY");

        Deposit storage _deposit = deposits[depositRequestIdx];

        uint amount = _deposit.amount;
        require(amount > 0, "WITHDRAWN_ALREADY");

        // Set the amount to 0 so it cannot be withdrawn again
        _deposit.amount = 0;

        // Transfer the tokens
        Account storage account = accounts[_deposit.accountID];
        withdrawAndBurn(
            account.owner,
            _deposit.tokenID,
            amount,
            isFeeRecipientAccount(account)
        );
    }

    function withdrawFromApprovedWithdrawal(
        uint blockIdx,
        uint slotIdx
        )
        external
    {
        // TODO: special case if slotIdx == 0 to search in byte array
        //       (maybe not needed anymore with automatic transferring in normal cases)

        // require(isInWithdrawalMode(), "NOT_IN_WITHDRAW_MODE");

        require(blockIdx < blocks.length, "INVALID_BLOCK_IDX");
        Block storage withdrawBlock = blocks[blockIdx];

        // Only allow withdrawing on finalized blocks
        require(withdrawBlock.state == BlockState.FINALIZED, "BLOCK_NOT_FINALIZED");

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

        Account storage account = accounts[accountID];

        if (amount > 0) {
            // Set the amount to 0 so it cannot be withdrawn anymore
            data = data & 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF000000000000000000000000;
            assembly {
                mstore(add(withdrawals, offset), data)
            }
            withdrawBlock.withdrawals = withdrawals;

            // Transfer the tokens
            withdrawAndBurn(account.owner, tokenID, amount, isFeeRecipientAccount(account));
        }

        emit WithdrawalCompleted(
            accountID,
            tokenID,
            account.owner,
            uint96(amount)
        );
    }
*/

    function withdrawBlockFee(
        uint32 blockIdx
        )
        external
        returns (uint feeAmount)
    {
        // require(msg.sender == exchangeOwner, "UNAUTHORIZED");
        require(blockIdx > 0 && blockIdx < blocks.length, "INVALID_BLOCK_IDX");
        Block storage requestedBlock = blocks[blockIdx];
        Block storage previousBlock = blocks[blockIdx - 1];

        require(requestedBlock.state == BlockState.FINALIZED, "BLOCK_NOT_FINALIZED");
        require(requestedBlock.blockFeeWithdrawn == false, "FEE_WITHDRAWN_ALREADY");

        feeAmount = 0;
        if(requestedBlock.numDepositRequestsCommitted > previousBlock.numDepositRequestsCommitted) {
            feeAmount = depositChain[requestedBlock.numDepositRequestsCommitted - 1].accumulatedFee.sub(
                depositChain[previousBlock.numDepositRequestsCommitted - 1].accumulatedFee
            );
        } else if(requestedBlock.numWithdrawRequestsCommitted > previousBlock.numWithdrawRequestsCommitted) {
            feeAmount = withdrawalChain[requestedBlock.numWithdrawRequestsCommitted - 1].accumulatedFee.sub(
                withdrawalChain[previousBlock.numWithdrawRequestsCommitted - 1].accumulatedFee
            );
        } else {
            revert("BLOCK_HAS_NO_OPERATOR_FEE");
        }

        // Make sure it can't be withdrawn again
        requestedBlock.blockFeeWithdrawn = true;

        // Transfer the fee to the operator
        operator.transfer(feeAmount);

        emit BlockFeeWithdraw(blockIdx, feeAmount);

        return feeAmount;
    }

    function distributeWithdrawals(
        uint blockIdx
        )
        external
    {
        require(blockIdx < blocks.length, "INVALID_BLOCK_IDX");
        Block storage withdrawBlock = blocks[blockIdx];

        // Only allow withdrawing on finalized blocks
        require(withdrawBlock.state == BlockState.FINALIZED, "BLOCK_NOT_FINALIZED");

        // TODO: Check if transfers still need to be done + do all tranfers + update necessary state
        //       Make sure to zero out this data when done, this will not only make sure it cannot be withdrawn again
        //       it will also save on gas for the operator because he will get a rebate for reverting storage data to 0
        // Maybe we can even allow doing the withdrawals in parts so we don't have a single very large transaction?
        // We should allow the transfer to fail in here, in that case the user could maybe retry manually later?
    }


    // == Internal Functions ==
    function withdrawAndBurn(
        address accountOwner,
        uint16 tokenID,
        uint amount,
        bool bBurn
        )
        internal
    {
        address payable owner = address(uint160(accountOwner));
        address token = getTokenAddress(tokenID);

        // Calculate how much needs to get burned
        uint amountToBurn = 0;
        uint amountToOwner = 0;
        if (bBurn) {
            uint burnRate = loopring.getTokenBurnRate(token);
            amountToBurn = amount.mul(burnRate) / 10000;
            amountToOwner = amount - amountToBurn;
        } else {
            amountToBurn = 0;
            amountToOwner = amount;
        }

        // Fee-burning
        if (amountToBurn > 0) {
            if (token == address(0x0)) {
                // ETH
                address payable payableLoopringAddress = address(uint160(loopringAddress));
                payableLoopringAddress.transfer(amountToOwner);
            } else if (token == lrcAddress) {
                // LRC: burn LRC directly
                require(BurnableERC20(lrcAddress).burn(amountToBurn), "BURN_FAILURE");
            } else {
                // ERC20 token (not LRC)
                require(token.safeTransfer(loopringAddress, amountToBurn), "TRANSFER_FAILURE");
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