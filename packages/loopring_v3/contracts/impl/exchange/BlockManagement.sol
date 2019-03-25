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

import "../../iface/exchange/IBlockManagement.sol";
import "./AccountManagement.sol";

import "../../iface/ILoopringV3.sol";

import "../../iface/IBlockVerifier.sol";
import "../../iface/IExchangeHelper.sol";

import "../../lib/BurnableERC20.sol";
import "../../lib/ERC20SafeTransfer.sol";
import "../../lib/MathUint.sol";
import "../../lib/NoDefaultFunc.sol";


/// @title An Implementation of IDEX.
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
contract BlockManagement is IBlockManagement, AccountManagement
{
    enum BlockType
    {
        SETTLEMENT,
        DEPOSIT,
        ONCHAIN_WITHDRAW,
        OFFCHAIN_WITHDRAW,
        CANCEL
    }

    enum BlockState
    {
        COMMITTED,
        VERIFIED,
        FINALIZED
    }

    struct Block
    {
        bytes32 merkleRoot;
        bytes32 publicDataHash;

        BlockState state;

        uint32 timestamp;
        uint32 numDepositBlocksCommitted;
        uint32 numWithdrawBlocksCommitted;
        bytes  withdrawals;
    }

    // == Private Variables ==

    Block[] blocks;

    // == Public Functions ==

    function setFees(
        uint _minimumDepositFee,
        uint _minimumWithdrawFee
        )
        external
    {
        // TODO: only allow the fees to change every ~1 day
        // require(msg.sender == exchangeOwner, "UNAUTHORIZED");
        require(_minimumWithdrawFee <= loopring.maxWithdrawFee(), "TOO_LARGE_AMOUNT");

        minimumDepositFee = _minimumDepositFee;
        minimumWithdrawFee = _minimumWithdrawFee;
    }

    function getDepositFee()
        external
        view
        returns (uint)
    {
        return minimumDepositFee;
    }

    function getWithdrawFee()
        external
        view
        returns (uint)
    {
        return minimumWithdrawFee;
    }

    function commitBlock(
        uint blockType,
        bytes calldata data
        )
        external
        // onlyOperator
    {
        commitBlockInternal(blockType, data);
    }

    function verifyBlock(
        uint blockIdx,
        uint256[8] calldata proof
        )
        external
    {
        // Exchange cannot be in withdraw mode
        require(!isInWithdrawMode(), "IN_WITHDRAW_MODE");

        require(blockIdx < blocks.length, "INVALID_BLOCK_IDX");
        Block storage specifiedBlock = blocks[blockIdx];
        require(specifiedBlock.state == BlockState.COMMITTED, "BLOCK_VERIFIED_ALREADY");

        require(
            IBlockVerifier(blockVerifierAddress).verifyProof(
                specifiedBlock.publicDataHash, proof
            ),
            "INVALID_PROOF"
        );

        // Update state of this block and potentially the following blocks
        Block storage previousBlock = blocks[blockIdx - 1];
        if (previousBlock.state == BlockState.FINALIZED) {
            specifiedBlock.state = BlockState.FINALIZED;
            emit BlockFinalized(blockIdx);
            // The next blocks could become finalized as well so check this now
            // The number of blocks after the specified block index is limited
            // so we don't have to worry about running out of gas in this loop
            uint nextBlockIdx = blockIdx + 1;
            while (nextBlockIdx < blocks.length &&
                blocks[nextBlockIdx].state == BlockState.VERIFIED) {

                blocks[nextBlockIdx].state = BlockState.FINALIZED;
                emit BlockFinalized(nextBlockIdx);
                nextBlockIdx++;
            }
        } else {
            specifiedBlock.state = BlockState.VERIFIED;
        }
    }

    function revertBlock(
        uint32 blockIdx
        )
        external
    {
        require(blockIdx < blocks.length, "INVALID_BLOCK_IDX");
        Block storage specifiedBlock = blocks[blockIdx];
        require(specifiedBlock.state == BlockState.COMMITTED, "INVALID_BLOCK_STATE");

        // The specified block needs to be the first block not finalized
        // (this way we always revert to a guaranteed valid block and don't need to revert multiple times)
        Block storage previousBlock = blocks[uint(blockIdx).sub(1)];
        require(previousBlock.state == BlockState.FINALIZED, "PREV_BLOCK_NOT_FINALIZED");

        // Check if this block is verified too late
        require(
            now > specifiedBlock.timestamp + MAX_PROOF_GENERATION_TIME_IN_SECONDS,
            "TOO_LATE_PROOF"
        );

        // TODO: - burn stake amount of Exchange
        //       - store info somewhere in Exchange contract what block was reverted so
        //       - the ExchangeOwner can punish the operator that submitted the block

        // Remove all blocks after and including blockIdx
        blocks.length = blockIdx;

        emit Revert(blockIdx);
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

    function withdrawBlockFee(
        uint32 blockIdx
        )
        external
        returns (bool)
    {
        // require(msg.sender == exchangeOwner, "UNAUTHORIZED");
        require(blockIdx > 0 && blockIdx < blocks.length, "INVALID_BLOCK_IDX");
        Block storage requestedBlock = blocks[blockIdx];
        Block storage previousBlock = blocks[blockIdx - 1];

        require(requestedBlock.state == BlockState.FINALIZED, "BLOCK_NOT_FINALIZED");

        uint fee = 0;
        if(requestedBlock.numDepositBlocksCommitted > previousBlock.numDepositBlocksCommitted) {
            fee = depositBlocks[previousBlock.numDepositBlocksCommitted].fee;
            depositBlocks[previousBlock.numDepositBlocksCommitted].fee = 0;
        } else if (
            requestedBlock.numWithdrawBlocksCommitted > previousBlock.numWithdrawBlocksCommitted) {
            fee = withdrawBlocks[previousBlock.numWithdrawBlocksCommitted].fee;
            withdrawBlocks[previousBlock.numWithdrawBlocksCommitted].fee = 0;
        } else {
            revert("BLOCK_HAS_NO_OPERATOR_FEE");
        }
        require(fee == 0, "FEE_WITHDRAWN_ALREADY");

        operator.transfer(fee);

        emit BlockFeeWithdraw(blockIdx, fee);

        return true;
    }

    function getBlockIdx()
        external
        view
        returns (uint)
    {
        return blocks.length.sub(1);
    }

    function getNumAvailableDepositSlots()
        external
        view
        returns (uint)
    {
        if (isActiveDepositBlockClosed()) {
            return NUM_DEPOSITS_IN_BLOCK;
        } else {
            DepositBlock storage depositBlock = depositBlocks[numDepositBlocks - 1];
            return NUM_DEPOSITS_IN_BLOCK - depositBlock.numDeposits;
        }
    }

    function getNumAvailableWithdrawSlots()
        external
        view
        returns (uint)
    {
        if (isActiveWithdrawBlockClosed()) {
            return NUM_WITHDRAWALS_IN_BLOCK;
        } else {
            WithdrawBlock storage withdrawBlock = withdrawBlocks[numWithdrawBlocks - 1];
            return NUM_WITHDRAWALS_IN_BLOCK - withdrawBlock.numWithdrawals;
        }
    }

    function isInWithdrawMode()
        public
        view
        returns (bool)
    {
        Block storage currentBlock = blocks[blocks.length - 1];
        WithdrawBlock storage withdrawBlock =
            withdrawBlocks[currentBlock.numWithdrawBlocksCommitted];

        DepositBlock storage depositBlock =
            depositBlocks[currentBlock.numDepositBlocksCommitted];

        return isOnchainBlockTooLate(depositBlock.timestampOpened) ||
                   isOnchainBlockTooLate(withdrawBlock.timestampOpened);
    }

    function isOnchainBlockTooLate(
        uint timestampOpened
        )
        public
        view
        returns (bool)
    {
        return (timestampOpened != 0 && timestampOpened + MAX_TIME_BLOCK_UNTIL_WITHDRAWALMODE < now);
    }

    function withdrawFromMerkleTree(
        uint16 tokenID,
        uint256[24] calldata accountPath,
        uint256[12] calldata balancePath,
        uint32 nonce,
        uint96 balance,
        uint256 tradeHistoryRoot
        )
        external
        returns (bool)
    {
        return withdrawFromMerkleTreeForAccount(
            getAccountID(),
            tokenID,
            accountPath,
            balancePath,
            nonce,
            balance,
            tradeHistoryRoot
        );
    }

    // We still alow anyone to withdraw these funds for the account owner
    function withdrawFromMerkleTreeForAccount(
        uint24 accountID,
        uint16 tokenID,
        uint256[24] memory accountPath,
        uint256[12] memory balancePath,
        uint32 nonce,
        uint96 balance,
        uint256 tradeHistoryRoot
        )
        public
        returns (bool)
    {
        require(isInWithdrawMode(), "NOT_IN_WITHDRAW_MODE");

        Block storage lastBlock = blocks[blocks.length - 1];
        require(lastBlock.state == BlockState.FINALIZED, "PREV_BLOCK_NOT_FINALIZED");

        Account storage account = getAccount(accountID);
        require(account.withdrawn == false, "WITHDRAWN_ALREADY");

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
        account.withdrawn = true;

        // Transfer the tokens
        withdrawAndBurn(account.owner, tokenID, balance, isFeeRecipientAccount(account));

        return true;
    }

    function verifyAccountBalance(
        bytes32 merkleRoot,
        uint24 accountID,
        uint16 tokenID,
        uint256[24] memory accountPath,
        uint256[12] memory balancePath,
        Account storage account,
        uint32 nonce,
        uint96 balance,
        uint256 tradeHistoryRoot
        )
        internal
    {
        IExchangeHelper(exchangeHelperAddress).verifyAccountBalance(
            uint256(merkleRoot),
            accountID,
            tokenID,
            accountPath,
            balancePath,
            account.publicKeyX,
            account.publicKeyY,
            0,
            nonce,
            balance,
            tradeHistoryRoot
        );
    }

    function withdrawFromPendingDeposit(
        uint depositBlockIdx,
        uint slotIdx
        )
        external
        returns (bool)
    {
        require(isInWithdrawMode(), "NOT_IN_WITHDRAW_MODE");

        Block storage lastBlock = blocks[blocks.length - 1];
        require(lastBlock.state == BlockState.FINALIZED, "PREV_BLOCK_NOT_FINALIZED");

        require (depositBlockIdx >= lastBlock.numDepositBlocksCommitted, "BLOCK_COMMITTED_ALREADY");

        require(depositBlockIdx < numDepositBlocks, "INVALID_BLOCK_IDX");
        require(
            slotIdx < depositBlocks[depositBlockIdx].pendingDeposits.length,
            "INVALID_SLOT_IDX"
        );

        PendingDeposit storage pendingDeposit =
            depositBlocks[depositBlockIdx].pendingDeposits[slotIdx];

        uint amount = pendingDeposit.amount;
        require(amount > 0, "WITHDRAWN_ALREADY");

        // Set the amount to 0 so it cannot be withdrawn again
        pendingDeposit.amount = 0;

        // Transfer the tokens
        Account storage account = getAccount(pendingDeposit.accountID);
        withdrawAndBurn(account.owner, pendingDeposit.tokenID, amount, isFeeRecipientAccount(account));
    }

    function withdrawFromApprovedWithdrawal(
        uint blockIdx,
        uint slotIdx
        )
        external
    {
        // TODO: special case if slotIdx == 0 to search in byte array
        //       (maybe not needed anymore with automatic transferring in normal cases)

        require(isInWithdrawMode(), "NOT_IN_WITHDRAW_MODE");

        require(blockIdx < blocks.length, "INVALID_BLOCK_IDX");
        Block storage withdrawBlock = blocks[blockIdx];

        // Only allow withdrawing on finalized blocks
        require(withdrawBlock.state == BlockState.FINALIZED, "BLOCK_NOT_FINALIZED");

        // Get the withdraw data of the given slot
        // TODO: optimize
        bytes memory withdrawals = withdrawBlock.withdrawals;
        uint offset = 4 + 32 + 32 + 3 + 32 + (3 + 2 + 12) * (slotIdx + 1);
        require(offset < withdrawals.length + 32, "INVALID_SLOT_IDX");
        uint data;
        assembly {
            data := mload(add(withdrawals, offset))
        }

        // Extract the data
        uint24 accountID = uint24((data / 0x10000000000000000000000000000) & 0xFFFFFF);
        uint16 tokenID = uint16((data / 0x1000000000000000000000000) & 0xFFFF);
        uint amount = data & 0xFFFFFFFFFFFFFFFFFFFFFFFF;

        Account storage account = getAccount(accountID);

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

        emit Withdraw(accountID, tokenID, account.owner, uint96(amount));
    }

    function setOperator(address payable _operator)
        external
        // onlyOwner
        returns (address payable oldOperator)
    {
        require(address(0) != _operator, "ZERO_ADDRESS");
        oldOperator = operator;
        operator = _operator;

        emit OperatorChanged(
            id,
            oldOperator,
            operator
        );
    }

    // == Internal Functions ==

    modifier onlyOperator()
    {
        require(msg.sender == operator, "UNAUTHORIZED");
        _;
    }

    function commitBlockInternal(
        uint blockType,
        bytes memory data
        )
        internal
    {
        // Extract the exchange ID from the data
        /*uint32 exchangeIdInData = 0;
        assembly {
            exchangeIdInData := and(mload(add(data, 4)), 0xFFFFFFFF)
        }
        require(exchangeIdInData == id, "INVALID_ID");*/

        // Exchange cannot be in withdraw mode
        require(!isInWithdrawMode(), "IN_WITHDRAW_MODE");

        // Get the current block
        Block storage currentBlock = blocks[blocks.length - 1];

        bytes32 merkleRootBefore;
        bytes32 merkleRootAfter;
        assembly {
            merkleRootBefore := mload(add(data, 36))
            merkleRootAfter := mload(add(data, 68))
        }
        require(merkleRootBefore == currentBlock.merkleRoot, "INVALID_MERKLE_ROOT");

        uint32 numDepositBlocksCommitted = currentBlock.numDepositBlocksCommitted;
        uint32 numWithdrawBlocksCommitted = currentBlock.numWithdrawBlocksCommitted;
        if (blockType == uint(BlockType.SETTLEMENT)) {
            uint32 inputTimestamp;
            assembly {
                inputTimestamp := and(mload(add(data, 75)), 0xFFFFFFFF)
            }
            require(
                inputTimestamp > now - TIMESTAMP_WINDOW_SIZE_IN_SECONDS &&
                inputTimestamp < now + TIMESTAMP_WINDOW_SIZE_IN_SECONDS,
                "INVALID_TIMESTAMP"
            );
        } else if (blockType == uint(BlockType.DEPOSIT)) {
            require(
                isDepositBlockCommittable(numDepositBlocksCommitted),
                "CANNOT_COMMIT_BLOCK_YET"
            );

            DepositBlock storage depositBlock = depositBlocks[numDepositBlocksCommitted];
            bytes32 depositBlockHash = depositBlock.hash;
            // Pad the block so it's full
            for (uint i = depositBlock.numDeposits; i < NUM_DEPOSITS_IN_BLOCK; i++) {
                depositBlockHash = sha256(
                    abi.encodePacked(
                        depositBlockHash,
                        uint24(0),
                        DEFAULT_ACCOUNT_PUBLICKEY_X,
                        DEFAULT_ACCOUNT_PUBLICKEY_Y,
                        uint24(0),
                        uint16(0),
                        uint96(0)
                    )
                );
            }
            assembly {
                mstore(add(data, 100), depositBlockHash)
            }
            numDepositBlocksCommitted++;
        } else if (blockType == uint(BlockType.ONCHAIN_WITHDRAW)) {
            require(
                isWithdrawBlockCommittable(numWithdrawBlocksCommitted),
                "CANNOT_COMMIT_BLOCK_YET"
            );

            WithdrawBlock storage withdrawBlock = withdrawBlocks[numWithdrawBlocksCommitted];
            bytes32 withdrawBlockHash = withdrawBlock.hash;
            // Pad the block so it's full
            for (uint i = withdrawBlock.numWithdrawals; i < NUM_WITHDRAWALS_IN_BLOCK; i++) {
                withdrawBlockHash = sha256(
                    abi.encodePacked(
                        withdrawBlockHash,
                        uint24(0),
                        uint16(0),
                        uint96(0)
                    )
                );
            }
            assembly {
                mstore(add(data, 103), withdrawBlockHash)
            }
            numWithdrawBlocksCommitted++;
        }

        // Check if we need to commit a deposit or withdraw block
        require(!isWithdrawBlockForced(numWithdrawBlocksCommitted), "BLOCK_COMMIT_FORCED");
        require(!isDepositBlockForced(numDepositBlocksCommitted), "BLOCK_COMMIT_FORCED");

        bytes32 publicDataHash = sha256(data);

        // Create a new block with the updated merkle roots
        Block memory newBlock = Block(
            merkleRootAfter,
            publicDataHash,
            BlockState.COMMITTED,
            uint32(now),
            numDepositBlocksCommitted,
            numWithdrawBlocksCommitted,
            (blockType == uint(BlockType.ONCHAIN_WITHDRAW) ||
             blockType == uint(BlockType.OFFCHAIN_WITHDRAW)) ? data : new bytes(0)
        );
        blocks.push(newBlock);

        emit BlockCommitted(blocks.length - 1, publicDataHash);
    }

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

        // Increase the burn balance
        if (amountToBurn > 0) {
            // TODO: send to LoopringV3 contract for burning / burn LRC directly
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

    function isActiveDepositBlockClosed()
        internal
        view
        returns (bool)
    {
        DepositBlock storage depositBlock = depositBlocks[numDepositBlocks - 1];
        return isActiveOnchainBlockClosed(
            depositBlock.numDeposits,
            NUM_DEPOSITS_IN_BLOCK,
            depositBlock.timestampOpened
        );
    }

    function isDepositBlockCommittable(
        uint32 depositBlockIdx
        )
        internal
        view
        returns (bool)
    {
        assert(depositBlockIdx < numDepositBlocks);
        DepositBlock storage depositBlock = depositBlocks[depositBlockIdx];
        return isOnchainBlockCommittable(
            depositBlock.numDeposits,
            NUM_DEPOSITS_IN_BLOCK,
            depositBlock.timestampOpened,
            depositBlock.timestampFilled
        );
    }

    function isDepositBlockForced(
        uint32 depositBlockIdx
        )
        internal
        view
        returns (bool)
    {
        assert(depositBlockIdx <= numDepositBlocks);
        DepositBlock storage depositBlock = depositBlocks[depositBlockIdx];
        return isOnchainBlockForced(
            depositBlock.numDeposits,
            NUM_DEPOSITS_IN_BLOCK,
            depositBlock.timestampOpened,
            depositBlock.timestampFilled
        );
    }

    function isActiveWithdrawBlockClosed()
        internal
        view
        returns (bool)
    {
        WithdrawBlock storage withdrawBlock = withdrawBlocks[numWithdrawBlocks - 1];
        return isActiveOnchainBlockClosed(
            withdrawBlock.numWithdrawals,
            NUM_WITHDRAWALS_IN_BLOCK,
            withdrawBlock.timestampOpened
        );
    }

    function isWithdrawBlockCommittable(
        uint32 withdrawBlockIdx
        )
        internal
        view
        returns (bool)
    {
        assert(withdrawBlockIdx < numWithdrawBlocks);
        WithdrawBlock storage withdrawBlock = withdrawBlocks[withdrawBlockIdx];
        return isOnchainBlockCommittable(
            withdrawBlock.numWithdrawals,
            NUM_WITHDRAWALS_IN_BLOCK,
            withdrawBlock.timestampOpened,
            withdrawBlock.timestampFilled
        );
    }

    function isWithdrawBlockForced(
        uint32 withdrawBlockIdx
        )
        internal
        view
        returns (bool)
    {
        assert(withdrawBlockIdx <= numWithdrawBlocks);
        WithdrawBlock storage withdrawBlock = withdrawBlocks[withdrawBlockIdx];
        return isOnchainBlockForced(
            withdrawBlock.numWithdrawals,
            NUM_WITHDRAWALS_IN_BLOCK,
            withdrawBlock.timestampOpened,
            withdrawBlock.timestampFilled
        );
    }

    function isActiveOnchainBlockClosed(
        uint count,
        uint maxCount,
        uint32 timestampOpened
        )
        internal
        view
        returns (bool)
    {
        if ((count == maxCount && now > timestampOpened + MIN_TIME_BLOCK_OPEN) ||
                (count > 0 && now > timestampOpened + MAX_TIME_BLOCK_OPEN)) {
            return true;
        } else {
            return false;
        }
    }

    function isOnchainBlockCommittable(
        uint count,
        uint maxCount,
        uint timestampOpened,
        uint timestampFilled
        )
        internal
        view
        returns (bool)
    {
        if ((count == maxCount && now > timestampFilled + MIN_TIME_BLOCK_CLOSED_UNTIL_COMMITTABLE) ||
                (count > 0 && now > timestampOpened + MAX_TIME_BLOCK_OPEN + MIN_TIME_BLOCK_CLOSED_UNTIL_COMMITTABLE)) {
            return true;
        } else {
            return false;
        }
    }

    function isOnchainBlockForced(
        uint count,
        uint maxCount,
        uint timestampOpened,
        uint timestampFilled
        )
        internal
        view
        returns (bool)
    {
        if ((count == maxCount && now > timestampFilled + MAX_TIME_BLOCK_CLOSED_UNTIL_FORCED) ||
                (count > 0 && now > timestampOpened + MAX_TIME_BLOCK_OPEN + MAX_TIME_BLOCK_CLOSED_UNTIL_FORCED)) {
            return true;
        } else {
            return false;
        }
    }
}