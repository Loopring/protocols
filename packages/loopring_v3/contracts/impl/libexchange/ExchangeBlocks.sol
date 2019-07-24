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
pragma solidity 0.5.7;

import "../../lib/BytesUtil.sol";
import "../../lib/MathUint.sol";

import "../../iface/IBlockVerifier.sol";
import "../../iface/IDecompressor.sol";

import "./ExchangeData.sol";
import "./ExchangeMode.sol";


/// @title ExchangeBlocks.
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
library ExchangeBlocks
{
    using BytesUtil         for bytes;
    using MathUint          for uint;
    using ExchangeMode      for ExchangeData.State;

    event BlockCommitted(
        uint    indexed blockIdx,
        bytes32 indexed publicDataHash
    );

    event BlockFinalized(
        uint    indexed blockIdx
    );

    event BlockVerified(
        uint    indexed blockIdx
    );

    event Revert(
        uint    indexed blockIdx
    );

    event ProtocolFeesUpdated(
        uint8 takerFeeBips,
        uint8 makerFeeBips,
        uint8 previousTakerFeeBips,
        uint8 previousMakerFeeBips
    );

    function commitBlock(
        ExchangeData.State storage S,
        uint8  blockType,
        uint16 blockSize,
        uint8  blockVersion,
        bytes memory data,
        address processor
        )
        internal  // inline call
    {
        commitBlockInternal(
            S,
            ExchangeData.BlockType(blockType),
            blockSize,
            blockVersion,
            data,
            processor
        );
    }

    function verifyBlocks(
        ExchangeData.State storage S,
        uint[] memory blockIndices,
        uint256[] memory proofs
        )
        public
    {
        // Exchange cannot be in withdrawal mode
        require(!S.isInWithdrawalMode(), "INVALID_MODE");

        // Check input data
        require(blockIndices.length > 0, "INVALID_INPUT_ARRAYS");
        require(proofs.length % 8 == 0, "INVALID_PROOF_ARRAY");
        require(proofs.length / 8 == blockIndices.length, "INVALID_INPUT_ARRAYS");

        uint256[] memory publicInputs = new uint256[](blockIndices.length);
        uint16 blockSize;
        ExchangeData.BlockType blockType;
        uint8 blockVersion;
        for (uint i = 0; i < blockIndices.length; i++) {
            uint blockIdx = blockIndices[i];

            require(blockIdx < S.blocks.length, "INVALID_BLOCK_IDX");
            ExchangeData.Block storage specifiedBlock = S.blocks[blockIdx];
            require(
                specifiedBlock.state == ExchangeData.BlockState.COMMITTED,
                "BLOCK_VERIFIED_ALREADY"
            );

            // Check if the proof for this block is too early
            // We limit the gap between the last finalized block and the last verified block to limit
            // the number of blocks that can become finalized when a single block is verified
            require(
                blockIdx < S.numBlocksFinalized + ExchangeData.MAX_GAP_BETWEEN_FINALIZED_AND_VERIFIED_BLOCKS(),
                "PROOF_TOO_EARLY"
            );

            // Check if we still accept a proof for this block
            require(
                now <= specifiedBlock.timestamp + ExchangeData.MAX_PROOF_GENERATION_TIME_IN_SECONDS(),
                "PROOF_TOO_LATE"
            );

            // Maybe we should strip the highest bits of the public input so we don't have any overflow (uint256/prime field)
            publicInputs[i] = uint256(specifiedBlock.publicDataHash);
            if (i == 0) {
                blockSize = specifiedBlock.blockSize;
                blockType = specifiedBlock.blockType;
                blockVersion = specifiedBlock.blockVersion;
            } else {
                // We only support batch verifying blocks that use the same verifying key
                require(blockType == specifiedBlock.blockType, "INVALID_BATCH_BLOCK_TYPE");
                require(blockSize == specifiedBlock.blockSize, "INVALID_BATCH_BLOCK_SIZE");
                require(blockVersion == specifiedBlock.blockVersion, "INVALID_BATCH_BLOCK_VERSION");
            }
        }

        // Verify the proofs
        require(
            S.blockVerifier.verifyProofs(
                uint8(blockType),
                S.onchainDataAvailability,
                blockSize,
                blockVersion,
                publicInputs,
                proofs
            ),
            "INVALID_PROOF"
        );

        // Mark the blocks as verified
        for (uint i = 0; i < blockIndices.length; i++) {
            uint blockIdx = blockIndices[i];
            ExchangeData.Block storage specifiedBlock = S.blocks[blockIdx];
            // Check this again to make sure no block is verified twice in a single call to verifyBlocks
            require(
                specifiedBlock.state == ExchangeData.BlockState.COMMITTED,
                "BLOCK_VERIFIED_ALREADY"
            );
            specifiedBlock.state = ExchangeData.BlockState.VERIFIED;
            emit BlockVerified(blockIdx);
        }

        // Update the number of blocks that are finalized
        // The number of blocks after the specified block index is limited
        // by MAX_GAP_BETWEEN_FINALIZED_AND_VERIFIED_BLOCKS
        // so we don't have to worry about running out of gas in this loop
        uint idx = S.numBlocksFinalized;
        while (idx < S.blocks.length &&
            S.blocks[idx].state == ExchangeData.BlockState.VERIFIED) {
            emit BlockFinalized(idx);
            idx++;
        }
        S.numBlocksFinalized = idx;
    }

    function revertBlock(
        ExchangeData.State storage S,
        uint blockIdx
        )
        public
    {
        // Exchange cannot be in withdrawal mode
        require(!S.isInWithdrawalMode(), "INVALID_MODE");

        require(blockIdx < S.blocks.length, "INVALID_BLOCK_IDX");
        ExchangeData.Block storage specifiedBlock = S.blocks[blockIdx];
        require(specifiedBlock.state == ExchangeData.BlockState.COMMITTED, "INVALID_BLOCK_STATE");

        // The specified block needs to be the first block not finalized
        // (this way we always revert to a guaranteed valid block and don't revert multiple times)
        require(blockIdx == S.numBlocksFinalized, "PREV_BLOCK_NOT_FINALIZED");

        // Check if this block is verified too late
        require(
            now > specifiedBlock.timestamp + ExchangeData.MAX_PROOF_GENERATION_TIME_IN_SECONDS(),
            "PROOF_NOT_TOO_LATE"
        );

        // Fine the exchange
        uint fine = S.loopring.revertFineLRC();
        S.loopring.burnExchangeStake(S.id, fine);

        // Remove all blocks after and including blockIdx
        S.blocks.length = blockIdx;

        emit Revert(blockIdx);
    }

    // == Internal Functions ==
    function commitBlockInternal(
        ExchangeData.State storage S,
        ExchangeData.BlockType blockType,
        uint16 blockSize,
        uint8  blockVersion,
        bytes memory data,  // This field already has all the dummy (0-valued) requests padded,
                            // therefore the size of this field totally depends on
                            // `blockSize` instead of the actual user requests processed
                            // in this block. This is fine because 0-bytes consume fewer gas.
        address processor
        )
        private
    {
        // Exchange cannot be in withdrawal mode
        require(!S.isInWithdrawalMode(), "INVALID_MODE");

        // Check if this exchange has a minimal amount of LRC staked
        require(
            S.loopring.canExchangeCommitBlocks(S.id, S.onchainDataAvailability),
            "INSUFFICIENT_EXCHANGE_STAKE"
        );

        // Check if the block is supported
        require(
            S.blockVerifier.isCircuitEnabled(
                uint8(blockType),
                S.onchainDataAvailability,
                blockSize,
                blockVersion
            ),
            "CANNOT_VERIFY_BLOCK"
        );

        // Extract the exchange ID from the data
        uint32 exchangeIdInData = 0;
        assembly {
            exchangeIdInData := and(mload(add(data, 4)), 0xFFFFFFFF)
        }
        require(exchangeIdInData == S.id, "INVALID_EXCHANGE_ID");

        // Get the current block
        ExchangeData.Block storage prevBlock = S.blocks[S.blocks.length - 1];

        // Get the old and new Merkle roots
        bytes32 merkleRootBefore;
        bytes32 merkleRootAfter;
        assembly {
            merkleRootBefore := mload(add(data, 36))
            merkleRootAfter := mload(add(data, 68))
        }
        require(merkleRootBefore == prevBlock.merkleRoot, "INVALID_MERKLE_ROOT");

        uint32 numDepositRequestsCommitted = uint32(prevBlock.numDepositRequestsCommitted);
        uint32 numWithdrawalRequestsCommitted = uint32(prevBlock.numWithdrawalRequestsCommitted);

        // When the exchange is shutdown:
        // - First force all outstanding deposits to be done
        // - Allow withdrawing using the special shutdown mode of ONCHAIN_WITHDRAWAL (with
        //   count == 0)
        if (S.isShutdown()) {
            if (numDepositRequestsCommitted < S.depositChain.length) {
                require(blockType == ExchangeData.BlockType.DEPOSIT, "SHUTDOWN_DEPOSIT_BLOCK_FORCED");
            } else {
                require(blockType == ExchangeData.BlockType.ONCHAIN_WITHDRAWAL, "SHUTDOWN_WITHDRAWAL_BLOCK_FORCED");
            }
        }

        // Check if the operator is forced to commit a deposit or withdraw block
        // We give priority to withdrawals. If a withdraw block is forced it needs to
        // be processed first, even if there is also a deposit block forced.
        if (isWithdrawalRequestForced(S, numWithdrawalRequestsCommitted)) {
            require(blockType == ExchangeData.BlockType.ONCHAIN_WITHDRAWAL, "WITHDRAWAL_BLOCK_FORCED");
        } else if (isDepositRequestForced(S, numDepositRequestsCommitted)) {
            require(blockType == ExchangeData.BlockType.DEPOSIT, "DEPOSIT_BLOCK_FORCED");
        }

        // Create a new block with the updated merkle roots
        ExchangeData.Block memory newBlock = ExchangeData.Block(
            merkleRootAfter,
            publicDataHash,
            ExchangeData.BlockState.COMMITTED,
            blockType,
            blockSize,
            blockVersion,
            uint32(now),
            numDepositRequestsCommitted,
            numWithdrawalRequestsCommitted,
            false,
            0,
            withdrawals
        );

        processor.processBlock(S, newBlock, data);

        S.blocks.push(newBlock);

        emit BlockCommitted(S.blocks.length - 1, publicDataHash);
    }


    function isDepositRequestForced(
        ExchangeData.State storage S,
        uint numRequestsCommitted
        )
        private
        view
        returns (bool)
    {
        if (numRequestsCommitted == S.depositChain.length) {
            return false;
        } else {
            return S.depositChain[numRequestsCommitted].timestamp < now.sub(
                ExchangeData.MAX_AGE_REQUEST_UNTIL_FORCED());
        }
    }

    function isWithdrawalRequestForced(
        ExchangeData.State storage S,
        uint numRequestsCommitted
        )
        private
        view
        returns (bool)
    {
        if (numRequestsCommitted == S.withdrawalChain.length) {
            return false;
        } else {
            return S.withdrawalChain[numRequestsCommitted].timestamp < now.sub(
                ExchangeData.MAX_AGE_REQUEST_UNTIL_FORCED());
        }
    }
}
