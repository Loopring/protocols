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

import "../../iface/exchange/IManagingBlocks.sol";

import "../../iface/IBlockVerifier.sol";
import "../../iface/ILoopringV3.sol";

import "../../lib/BurnableERC20.sol";
import "../../lib/ERC20SafeTransfer.sol";
import "../../lib/MathUint.sol";
import "../../lib/NoDefaultFunc.sol";

import "./Data.sol";


/// @title An Implementation of IManagingBlocks.
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
contract ManagingBlocks is IManagingBlocks, Data
{
    function isInWithdrawalMode()
        public
        view
        returns (bool result)
    {
        result = false;
        Block storage currentBlock = blocks[blocks.length - 1];

        if (currentBlock.numDepositRequestsCommitted < depositChain.length) {
            uint32 requestTimestamp = depositChain[currentBlock.numDepositRequestsCommitted].timestamp;

            result = requestTimestamp < now.sub(MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE);
        }

        if (result == false && currentBlock.numWithdrawRequestsCommitted < withdrawalChain.length) {
            uint32 requestTimestamp = withdrawalChain[currentBlock.numWithdrawRequestsCommitted].timestamp;

            result = requestTimestamp < now.sub(MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE);
        }
    }

    function getBlockHeight()
        external
        view
        returns (uint)
    {
        return blocks.length - 1;
    }

    function commitBlock(
        uint8 blockType,
        uint16 numElements,
        bytes calldata data
        )
        external
        onlyOperator
    {
        commitBlockInternal(blockType, numElements, data);
    }

    function commitBlockInternal(
        uint8 blockType,
        uint16 numElements,
        bytes memory data
        )
        internal
    {
        require(IBlockVerifier(blockVerifierAddress).canVerify(blockType, true, numElements), "UNSUPPORTED_BLOCK");

        // Extract the exchange ID from the data
        uint32 exchangeIdInData = 0;
        assembly {
            exchangeIdInData := and(mload(add(data, 4)), 0xFFFFFFFF)
        }
        require(exchangeIdInData == id, "INVALID_ID");

        // TODO: Check if this exchange has a minimal amount of LRC staked?

        // Exchange cannot be in withdraw mode
        require(!isInWithdrawalMode(), "INVALID_MODE");

        // Get the current block
        Block storage currentBlock = blocks[blocks.length - 1];

        bytes32 merkleRootBefore;
        bytes32 merkleRootAfter;
        assembly {
            merkleRootBefore := mload(add(data, 36))
            merkleRootAfter := mload(add(data, 68))
        }
        require(merkleRootBefore == currentBlock.merkleRoot, "INVALID_MERKLE_ROOT");

        uint32 numDepositRequestsCommitted = currentBlock.numDepositRequestsCommitted;
        uint32 numWithdrawRequestsCommitted = currentBlock.numWithdrawRequestsCommitted;

        // TODO: double check this logic
        // Check if the operator is forced to commit a deposit or withdraw block
        // We give priority to withdrawals. If a withdraw block is forced it needs to
        // be processed first, even if there is also a deposit block forced.
        if (blockType != uint(BlockType.ONCHAIN_WITHDRAW) && isWithdrawRequestForced(numWithdrawRequestsCommitted)) {
            revert("BLOCK_COMMIT_FORCED");
        } else if (blockType != uint(BlockType.DEPOSIT) && isDepositRequestForced(numDepositRequestsCommitted)) {
            revert("BLOCK_COMMIT_FORCED");
        }

        if (blockType == uint(BlockType.SETTLEMENT)) {
            uint32 inputTimestamp;
            assembly {
                inputTimestamp := and(mload(add(data, 75)), 0xFFFFFFFF)
            }
            require(
                inputTimestamp > now - TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS &&
                inputTimestamp < now + TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS,
                "INVALID_TIMESTAMP"
            );
        } else if (blockType == uint(BlockType.DEPOSIT)) {
            uint startIdx = 0;
            uint count = 0;
            assembly {
                startIdx := and(mload(add(data, 136)), 0xFFFFFFFF)
                count := and(mload(add(data, 140)), 0xFFFFFFFF)
            }
            require (startIdx == numDepositRequestsCommitted, "INVALID_DEPOSITREQUEST_RANGE");
            require (count <= numElements, "INVALID_DEPOSITREQUEST_RANGE");
            require (startIdx + count <= depositChain.length, "INVALID_DEPOSITREQUEST_RANGE");

            bytes32 startingHash = depositChain[startIdx - 1].accumulatedHash;
            bytes32 endingHash = depositChain[startIdx + count - 1].accumulatedHash;
            // Pad the block so it's full
            for (uint i = count; i < numElements; i++) {
                endingHash = sha256(
                    abi.encodePacked(
                        endingHash,
                        uint24(0),
                        DEFAULT_ACCOUNT_PUBLICKEY_X,
                        DEFAULT_ACCOUNT_PUBLICKEY_Y,
                        uint16(0),
                        uint96(0)
                    )
                );
            }
            assembly {
                mstore(add(data, 100), startingHash)
                mstore(add(data, 132), endingHash)
            }
            numDepositRequestsCommitted = uint32(startIdx + count);
        } else if (blockType == uint(BlockType.ONCHAIN_WITHDRAW)) {
            uint startIdx = 0;
            uint count = 0;
            assembly {
                startIdx := and(mload(add(data, 139)), 0xFFFFFFFF)
                count := and(mload(add(data, 143)), 0xFFFFFFFF)
            }
            require (startIdx == numWithdrawRequestsCommitted, "INVALID_WITHDRAWREQUEST_RANGE");
            require (count <= numElements, "INVALID_WITHDRAWREQUEST_RANGE");
            require (startIdx + count <= withdrawalChain.length, "INVALID_WITHDRAWREQUEST_RANGE");

            bytes32 startingHash = withdrawalChain[startIdx - 1].accumulatedHash;
            bytes32 endingHash = withdrawalChain[startIdx + count - 1].accumulatedHash;
            // Pad the block so it's full
            for (uint i = count; i < numElements; i++) {
                endingHash = sha256(
                    abi.encodePacked(
                        endingHash,
                        uint24(0),
                        uint16(0),
                        uint96(0)
                    )
                );
            }
            assembly {
                mstore(add(data, 103), startingHash)
                mstore(add(data, 135), endingHash)
            }
            numWithdrawRequestsCommitted = uint32(startIdx + count);
        }

        bytes32 publicDataHash = sha256(data);

        // Create a new block with the updated merkle roots
        Block memory newBlock = Block(
            merkleRootAfter,
            publicDataHash,
            BlockState.COMMITTED,
            blockType,
            numElements,
            uint32(now),
            numDepositRequestsCommitted,
            numWithdrawRequestsCommitted,
            false,
            (blockType == uint(BlockType.ONCHAIN_WITHDRAW) ||
             blockType == uint(BlockType.OFFCHAIN_WITHDRAW)) ? data : new bytes(0)
        );

        blocks.push(newBlock);

        emit BlockCommitted(blocks.length - 1, publicDataHash);
    }

    function verifyBlock(
        uint blockIdx,
        uint256[8] calldata proof
        )
        external
        onlyOperator
    {
        // Exchange cannot be in withdraw mode
        require(!isInWithdrawalMode(), "INVALID_MODE");

        require(blockIdx < blocks.length, "INVALID_BLOCK_IDX");
        Block storage specifiedBlock = blocks[blockIdx];
        require(specifiedBlock.state == BlockState.COMMITTED, "BLOCK_VERIFIED_ALREADY");

        require(
            IBlockVerifier(blockVerifierAddress).verifyProof(
                specifiedBlock.blockType,
                true,
                specifiedBlock.numElements,
                specifiedBlock.publicDataHash,
                proof
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
        onlyOperator
    {
        require(blockIdx < blocks.length, "INVALID_BLOCK_IDX");
        Block storage specifiedBlock = blocks[blockIdx];
        require(specifiedBlock.state == BlockState.COMMITTED, "INVALID_BLOCK_STATE");

        // The specified block needs to be the first block not finalized
        // (this way we always revert to a guaranteed valid block and don't need to revert multiple times)
        Block storage previousBlock = blocks[uint(blockIdx).sub(1)];
        require(previousBlock.state == BlockState.FINALIZED, "BLOCK_NOT_FINALIZED");

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

    // == Internal Functions ==
    function isDepositRequestForced(
        uint32 depositRequestIdx
        )
        internal
        view
        returns (bool)
    {
        if (depositRequestIdx < depositChain.length) {
            return depositChain[depositRequestIdx].timestamp < now.sub(MAX_AGE_REQUEST_UNTIL_FORCED);
        } else {
            return false;
        }
    }

    function isWithdrawRequestForced(
        uint32 withdrawRequestIdx
        )
        internal
        view
        returns (bool)
    {
        if (withdrawRequestIdx < withdrawalChain.length) {
            return withdrawalChain[withdrawRequestIdx].timestamp < now.sub(MAX_AGE_REQUEST_UNTIL_FORCED);
        } else {
            return false;
        }
    }
}