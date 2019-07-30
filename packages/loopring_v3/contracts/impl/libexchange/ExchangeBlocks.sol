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
pragma solidity 0.5.10;

import "../../lib/BytesUtil.sol";
import "../../lib/MathUint.sol";
import "../../lib/ProofVerification.sol";

import "../../iface/IBlockVerifier.sol";
import "../../iface/IDecompressor.sol";

import "../blocktypes/IBlockProcessor.sol";

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
    using ProofVerification for uint[18];

    event BlockFinalized(
        uint    indexed blockIdx
    );

    event BlockVerified(
        uint    indexed blockIdx
    );

    event Revert(
        uint    indexed blockIdx
    );

    function preCommit(
        ExchangeData.State storage S,
        uint8  blockType,
        bytes  memory data,
        bytes  memory /*offchainData*/
        )
        internal
        view
        returns (bytes32 publicDataHash)
    {
        // Exchange cannot be in withdrawal mode
        require(!S.isInWithdrawalMode(), "INVALID_MODE");

        // Check if this exchange has a minimal amount of LRC staked
        require(
            S.loopring.canExchangeCommitBlocks(S.id, S.onchainDataAvailability),
            "INSUFFICIENT_EXCHANGE_STAKE"
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

        uint32 numDepositRequestsCommitted = prevBlock.numDepositRequestsCommitted;
        uint32 numWithdrawalRequestsCommitted = prevBlock.numWithdrawalRequestsCommitted;

        // When the exchange is shutdown:
        // - First force all outstanding deposits to be done
        // - Allow withdrawing using the special shutdown mode of ONCHAIN_WITHDRAWAL (with
        //   count == 0)
        if (S.isShutdown()) {
            if (numDepositRequestsCommitted < S.depositChain.length) {
                require(blockType == 1 /* DEPOSIT */, "SHUTDOWN_DEPOSIT_BLOCK_FORCED");
            } else {
                require(blockType == 2 /* ONCHAIN_WITHDRAWAL */, "SHUTDOWN_WITHDRAWAL_BLOCK_FORCED");
            }
        }

        // Check if the operator is forced to commit a deposit or withdraw block
        // We give priority to withdrawals. If a withdraw block is forced it needs to
        // be processed first, even if there is also a deposit block forced.
        if (isWithdrawalRequestForced(S, numWithdrawalRequestsCommitted)) {
            require(blockType == 2 /* ONCHAIN_WITHDRAWAL */, "WITHDRAWAL_BLOCK_FORCED");
        } else if (isDepositRequestForced(S, numDepositRequestsCommitted)) {
            require(blockType == 1 /* DEPOSIT */, "DEPOSIT_BLOCK_FORCED");
        }

        // Hash all the public data to a single value which is used as the input for the circuit
        return data.fastSHA256();
    }

    function verifyBlocks(
        ExchangeData.State storage S,
        uint[] memory blockIndices,
        uint[] memory proofs
        )
        public
    {
        // Exchange cannot be in withdrawal mode
        require(!S.isInWithdrawalMode(), "INVALID_MODE");

        // Check input data
        require(blockIndices.length > 0, "INVALID_INPUT_ARRAYS");
        require(proofs.length % 8 == 0, "INVALID_PROOF_ARRAY");
        require(proofs.length / 8 == blockIndices.length, "INVALID_INPUT_ARRAYS");

        uint[] memory publicInputs = new uint[](blockIndices.length);
        uint16 blockSize;
        uint8  blockType;
        uint8  blockVersion;

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

        // Fetch the verification key then verify the proofs
        IBlockProcessor processor = IBlockProcessor(S.loopring.getBlockProcessor(blockType));
        uint[18] memory vk = processor.getVerificationKey(
            blockSize,
            blockVersion,
            S.onchainDataAvailability
        );
        require(vk.verifyProofs(publicInputs, proofs), "INVALID_PROOF");

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
