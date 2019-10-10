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
pragma experimental ABIEncoderV2;

import "../../lib/MathUint.sol";

import "./ExchangeData.sol";
import "./ExchangeStatus.sol";
import "./ExchangeBlockVerifier.sol";


/// @title ExchangeBlocks.
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
library ExchangeBlocks
{
    using MathUint          for uint;
    using ExchangeStatus    for ExchangeData.State;

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

    function commitBlock(
        ExchangeData.State storage state,
        bytes32 merkleRoot,
        bytes32 publicDataHash,
        uint32  blockSize,
        uint16  blockVersion
        )
        external
        returns (uint blockIdx)
    {
        // Exchange cannot be in withdrawal mode
        require(!state.isInWithdrawalMode(), "INVALID_MODE");

        // OPTIONAL: check for required modules here (list from Looping for example)
        // Check if this exchange has a minimal amount of LRC staked
        require(
            state.loopring.canExchangeCommitBlocks(state.id, state.onchainDataAvailability),
            "INSUFFICIENT_EXCHANGE_STAKE"
        );

        // Find if the block that is being committed is of the highest priority
        address prioritizedModule = getPrioritizedExchangeModule(state, msg.sender);
        require(msg.sender == prioritizedModule, "OTHER_EXCHANGE_MODULE_PRIORITIZED");

        // Create a new block with the updated merkle roots
        ExchangeData.Block memory newBlock = ExchangeData.Block(
            merkleRoot,
            publicDataHash,
            ExchangeData.BlockState.COMMITTED,
            IExchangeModule(msg.sender),
            blockSize,
            blockVersion,
            uint32(now),
            uint32(block.number)
        );
        state.blocks.push(newBlock);

        emit BlockCommitted(state.blocks.length - 1, publicDataHash);

        return state.blocks.length - 1;
    }

    function verifyBlocks(
        ExchangeData.State storage S,
        uint[] calldata blockIndices,
        uint[] calldata proofs
        )
        external
    {
        // Exchange cannot be in withdrawal mode
        require(!S.isInWithdrawalMode(), "INVALID_MODE");

        // Check input data
        require(blockIndices.length > 0, "INVALID_INPUT_ARRAYS");
        require(proofs.length % 8 == 0, "INVALID_PROOF_ARRAY");
        require(proofs.length / 8 == blockIndices.length, "INVALID_INPUT_ARRAYS");

        uint[] memory publicInputs = new uint[](blockIndices.length);
        uint32 blockSize;
        address module;
        uint16 blockVersion;

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

            // Strip the 3 least significant bits of the public data hash
            // so we don't have any overflow in the snark field
            publicInputs[i] = uint(specifiedBlock.publicDataHash) >> 3;
            if (i == 0) {
                module = address(specifiedBlock.module);
                blockSize = specifiedBlock.blockSize;
                blockVersion = specifiedBlock.blockVersion;
            } else {
                // We only support batch verifying blocks that use the same verifying key
                require(module == address(specifiedBlock.module), "INVALID_BATCH_MODULE");
                require(blockSize == specifiedBlock.blockSize, "INVALID_BATCH_BLOCK_SIZE");
                require(blockVersion == specifiedBlock.blockVersion, "INVALID_BATCH_BLOCK_VERSION");
            }
        }

        // Get the verification key
        CircuitData.VerificationKey memory verificationKey = IExchangeModule(module).getVerificationKey(
            CircuitData.Circuit(
                S.onchainDataAvailability,
                blockSize,
                blockVersion
            )
        );

        // Verify the proofs
        require(
            ExchangeBlockVerifier.verifyProofs(
                verificationKey,
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
        external
    {
        // Exchange cannot be in withdrawal mode
        require(!S.isInWithdrawalMode(), "INVALID_MODE");

        require(blockIdx < S.blocks.length, "INVALID_BLOCK_IDX");
        ExchangeData.Block storage specifiedBlock = S.blocks[blockIdx];
        require(specifiedBlock.state == ExchangeData.BlockState.COMMITTED, "INVALID_BLOCK_STATE");

        // The specified block needs to a non-finialized one.
        require(blockIdx >= S.numBlocksFinalized, "FINALIZED_BLOCK_REVERT_PROHIBITED");

        // Notify all modules
        for(uint i = 0; i < S.modules.length; i++) {
            S.modules[i].module.onRevert(blockIdx);
        }

        // Fine the exchange
        uint fine = S.loopring.revertFineLRC();
        S.loopring.burnExchangeStake(S.id, fine);

        // Remove all blocks after and including blockIdx
        S.blocks.length = blockIdx;

        emit Revert(blockIdx);
    }

    function getPrioritizedExchangeModule(
        ExchangeData.State storage state,
        address preferredExchangeModule
        )
        public
        view
        returns (address)
    {
        // Check for prioritized requests in all modules
        uint maxPriority = 0;
        address maxPriorityModule = preferredExchangeModule;
        for(uint i = 0; i < state.modules.length; i++) {
            address moduleAddress = address(state.modules[i].module);
            (, , uint priority) = state.modules[i].module.getStatus();
            if (maxPriority > priority || (maxPriority == priority && preferredExchangeModule == moduleAddress)) {
                maxPriority = priority;
                maxPriorityModule = moduleAddress;
            }
        }
        return maxPriorityModule;
    }
}
