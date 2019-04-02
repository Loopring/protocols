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
import "../../lib/MathUint.sol";
import "../../iface/IBlockVerifier.sol";

import "./ExchangeData.sol";
import "./ExchangeMode.sol";


/// @title ExchangeAccounts.
/// @author Daniel Wang  - <daniel@loopring.org>
/// @author Brecht Devos - <brecht@loopring.org>
library ExchangeBlocks
{
    using MathUint          for uint;
    using ExchangeMode      for ExchangeData.State;

    event BlockCommitted(
        uint    indexed blockIdx,
        bytes32 indexed publicDataHash
    );

    event BlockFinalized(
        uint    indexed blockIdx
    );

    event Revert(
        uint    indexed blockIdx
    );

    function commitBlock(
        ExchangeData.State storage S,
        uint8 blockType,
        uint16 numElements,
        bytes memory data
        )
        internal  // inline call
    {
        commitBlockInternal(S, blockType, numElements, data);
    }


    function verifyBlock(
        ExchangeData.State storage S,
        uint blockIdx,
        uint256[8] memory proof
        )
        internal  // inline call
    {
        // Exchange cannot be in withdraw mode
        require(!S.isInWithdrawalMode(), "INVALID_MODE");

        require(blockIdx < S.blocks.length, "INVALID_BLOCK_IDX");
        ExchangeData.Block storage specifiedBlock = S.blocks[blockIdx];
        require(specifiedBlock.state == ExchangeData.BlockState.COMMITTED, "BLOCK_VERIFIED_ALREADY");

        // Check if we still accept a proof for this block
        require(
            now <= specifiedBlock.timestamp + ExchangeData.MAX_PROOF_GENERATION_TIME_IN_SECONDS(),
            "PROOF_TOO_LATE"
        );

        require(
            S.blockVerifier.verifyProof(
                specifiedBlock.blockType,
                S.onchainDataAvailability,
                specifiedBlock.numElements,
                specifiedBlock.publicDataHash,
                proof
            ),
            "INVALID_PROOF"
        );

        // Update state of this block and potentially the following blocks
        ExchangeData.Block storage previousBlock = S.blocks[blockIdx - 1];
        if (previousBlock.state == ExchangeData.BlockState.FINALIZED) {
            specifiedBlock.state = ExchangeData.BlockState.FINALIZED;
            S.numBlocksFinalized = blockIdx + 1;
            emit BlockFinalized(blockIdx);
            // The next blocks could become finalized as well so check this now
            // The number of blocks after the specified block index is limited
            // so we don't have to worry about running out of gas in this loop
            uint nextBlockIdx = blockIdx + 1;
            while (nextBlockIdx < S.blocks.length &&
                S.blocks[nextBlockIdx].state == ExchangeData.BlockState.VERIFIED) {

                S.blocks[nextBlockIdx].state = ExchangeData.BlockState.FINALIZED;
                S.numBlocksFinalized = nextBlockIdx + 1;
                emit BlockFinalized(nextBlockIdx);
                nextBlockIdx++;
            }
        } else {
            specifiedBlock.state = ExchangeData.BlockState.VERIFIED;
        }
    }

    function revertBlock(
        ExchangeData.State storage S,
        uint32 blockIdx
        )
        public
    {
        // Exchange cannot be in withdraw mode
        require(!S.isInWithdrawalMode(), "INVALID_MODE");

        require(blockIdx < S.blocks.length, "INVALID_BLOCK_IDX");
        ExchangeData.Block storage specifiedBlock = S.blocks[blockIdx];
        require(specifiedBlock.state == ExchangeData.BlockState.COMMITTED, "INVALID_BLOCK_STATE");

        // The specified block needs to be the first block not finalized
        // (this way we always revert to a guaranteed valid block and don't need to revert multiple times)
        ExchangeData.Block storage previousBlock = S.blocks[uint(blockIdx).sub(1)];
        require(previousBlock.state == ExchangeData.BlockState.FINALIZED, "PREV_BLOCK_NOT_FINALIZED");

        // Check if this block is verified too late
        require(
            now > specifiedBlock.timestamp + ExchangeData.MAX_PROOF_GENERATION_TIME_IN_SECONDS(),
            "PROOF_TOO_LATE"
        );

        // Burn the complete stake of the exchange
        S.loopring.burnAllStake(S.id);

        // Remove all blocks after and including blockIdx
        S.blocks.length = blockIdx;

        emit Revert(blockIdx);
    }

    // == Internal Functions ==
    function commitBlockInternal(
        ExchangeData.State storage S,
        uint8 blockType,
        uint16 numElements,
        bytes memory data
        )
        private
    {
        // Exchange cannot be in withdraw mode
        require(!S.isInWithdrawalMode(), "INVALID_MODE");

        // TODO: Check if this exchange has a minimal amount of LRC staked?

        require(
            S.blockVerifier.canVerify(blockType, S.onchainDataAvailability, numElements),
            "CANNOT_VERIFY_BLOCK"
        );

        // Extract the exchange ID from the data
        uint32 exchangeIdInData = 0;
        assembly {
            exchangeIdInData := and(mload(add(data, 4)), 0xFFFFFFFF)
        }
        require(exchangeIdInData == S.id, "INVALID_ID");

        // Get the current block
        ExchangeData.Block storage currentBlock = S.blocks[S.blocks.length - 1];

        bytes32 merkleRootBefore;
        bytes32 merkleRootAfter;
        assembly {
            merkleRootBefore := mload(add(data, 36))
            merkleRootAfter := mload(add(data, 68))
        }
        require(merkleRootBefore == currentBlock.merkleRoot, "INVALID_MERKLE_ROOT");

        uint32 numDepositRequestsCommitted = currentBlock.numDepositRequestsCommitted;
        uint32 numWithdrawalRequestsCommitted = currentBlock.numWithdrawalRequestsCommitted;

        // Check if the operator is forced to commit a deposit or withdraw block
        // We give priority to withdrawals. If a withdraw block is forced it needs to
        // be processed first, even if there is also a deposit block forced.
        if (blockType != uint(ExchangeData.BlockType.ONCHAIN_WITHDRAW) &&
            isWithdrawalRequestForced(S, numWithdrawalRequestsCommitted)) {
            revert("WITHDRAWAL_BLOCK_COMMIT_FORCED");
        } else if (blockType != uint(ExchangeData.BlockType.DEPOSIT) &&
            isDepositRequestForced(S, numDepositRequestsCommitted)) {
            revert("DEPOSIT_BLOCK_COMMIT_FORCED");
        }

        if (blockType == uint(ExchangeData.BlockType.SETTLEMENT)) {
            require(now >= S.disableUserRequestsUntil, "SETTLEMENT_SUSPENDED");
            uint32 inputTimestamp;
            assembly {
                inputTimestamp := and(mload(add(data, 75)), 0xFFFFFFFF)
            }
            require(
                inputTimestamp > now - ExchangeData.TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS() &&
                inputTimestamp < now + ExchangeData.TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS(),
                "INVALID_TIMESTAMP"
            );
        } else if (blockType == uint(ExchangeData.BlockType.DEPOSIT)) {
            uint startIdx = 0;
            uint count = 0;
            assembly {
                startIdx := and(mload(add(data, 136)), 0xFFFFFFFF)
                count := and(mload(add(data, 140)), 0xFFFFFFFF)
            }
            require (startIdx == numDepositRequestsCommitted, "INVALID_REQUEST_RANGE");
            require (count <= numElements, "INVALID_REQUEST_RANGE");
            require (startIdx + count <= S.depositChain.length, "INVALID_REQUEST_RANGE");

            bytes32 startingHash = S.depositChain[startIdx - 1].accumulatedHash;
            bytes32 endingHash = S.depositChain[startIdx + count - 1].accumulatedHash;
            // Pad the block so it's full
            for (uint i = count; i < numElements; i++) {
                endingHash = sha256(
                    abi.encodePacked(
                        endingHash,
                        uint24(0),
                        uint256(0),
                        uint256(0),
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
        } else if (blockType == uint(ExchangeData.BlockType.ONCHAIN_WITHDRAW)) {
            uint startIdx = 0;
            uint count = 0;
            assembly {
                startIdx := and(mload(add(data, 139)), 0xFFFFFFFF)
                count := and(mload(add(data, 143)), 0xFFFFFFFF)
            }
            require (startIdx == numWithdrawalRequestsCommitted, "INVALID_REQUEST_RANGE");
            require (count <= numElements, "INVALID_REQUEST_RANGE");
            require (startIdx + count <= S.withdrawalChain.length, "INVALID_REQUEST_RANGE");

            bytes32 startingHash = S.withdrawalChain[startIdx - 1].accumulatedHash;
            bytes32 endingHash = S.withdrawalChain[startIdx + count - 1].accumulatedHash;
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
            numWithdrawalRequestsCommitted = uint32(startIdx + count);
        }

        bytes32 publicDataHash = sha256(data);

        // Create a new block with the updated merkle roots
        ExchangeData.Block memory newBlock = ExchangeData.Block(
            merkleRootAfter,
            publicDataHash,
            ExchangeData.BlockState.COMMITTED,
            blockType,
            numElements,
            uint32(now),
            numDepositRequestsCommitted,
            numWithdrawalRequestsCommitted,
            false,
            0,
            (blockType == uint(ExchangeData.BlockType.ONCHAIN_WITHDRAW) ||
             blockType == uint(ExchangeData.BlockType.OFFCHAIN_WITHDRAW)) ? data : new bytes(0)
        );

        S.blocks.push(newBlock);

        emit BlockCommitted(S.blocks.length - 1, publicDataHash);
    }

    function isDepositRequestForced(
        ExchangeData.State storage S,
        uint32 depositRequestIdx
        )
        private
        view
        returns (bool)
    {
        if (depositRequestIdx < S.depositChain.length) {
            return S.depositChain[depositRequestIdx].timestamp < now.sub(ExchangeData.MAX_AGE_REQUEST_UNTIL_FORCED());
        } else {
            return false;
        }
    }

    function isWithdrawalRequestForced(
        ExchangeData.State storage S,
        uint32 withdrawRequestIdx
        )
        private
        view
        returns (bool)
    {
        if (withdrawRequestIdx < S.withdrawalChain.length) {
            return S.withdrawalChain[withdrawRequestIdx].timestamp < now.sub(ExchangeData.MAX_AGE_REQUEST_UNTIL_FORCED());
        } else {
            return false;
        }
    }
}