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

import "../../impl/libexchange/ExchangeData.sol";


/// @title IExchangeV3Blocks
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
contract IExchangeV3Blocks
{
    // -- Events --
    // We need to make sure all events defined in ExchangeBlocks.sol
    // are aggregrated here.
    event BlockCommitted(
        uint    indexed blockIdx,
        bytes32 indexed publicDataHash
    );

    event BlockVerified(
        uint    indexed blockIdx
    );

    event BlockFinalized(
        uint    indexed blockIdx
    );

    event Revert(
        uint    indexed blockIdx
    );

    // -- Blocks --
    /// @dev Gets the height of this exchange's virtual blockchain. The block height for a
    ///      new exchange is 0.
    /// @return The virtual blockchain height
    function getBlockHeight()
        external
        view
        returns (uint);

    /// @dev Gets the number of finalized (i.e. irreversible) blocks.
    /// @return The number of finalized blocks
    function getNumBlocksFinalized()
        external
        view
        returns (uint);

    /// @dev Returns the block data for the specified block index.
    /// @param  blockIdx The block index
    /// @return merkleRoot The merkle root
    /// @return publicDataHash The hash of all public data. Used as public input for the ZKP.
    /// @return blockState The current state of the block
    /// @return blockType The type of work done in the block
    /// @return blockSize The number of requests handled in the block
    /// @return timestamp The time the block was committed on-chain
    /// @return blockState The current state of the block
    /// @return numDepositRequestsCommitted The total number of deposit requests committed
    /// @return numWithdrawalRequestsCommitted The total number of withdrawal requests committed
    /// @return blockFeeWithdrawn True if the block fee has been withdrawn, else false
    /// @return numWithdrawalsDistributed The number of withdrawals that have been done for this block
    function getBlock(
        uint blockIdx
        )
        external
        view
        returns (ExchangeData.Block memory);

    /// @dev Commits a new block to the virtual blockchain without the proof.
    ///
    ///      This function can only be called from an exchange module.
    ///
    /// @param merkleRoot The new Merkle root
    /// @param publicDataHash The hash of all public input (as used in the circuit)
    /// @param blockSize The number of onchain or offchain requests/settlements
    ///        that have been processed in this block
    /// @param blockVersion The circuit version to use for verifying the block
    function commitBlock(
        bytes32 merkleRoot,
        bytes32 publicDataHash,
        uint32  blockSize,
        uint16  blockVersion
        )
        external
        returns (uint);

    /// @dev Submits ZK proofs onchain to verify previously committed blocks. Submitting an
    ///      invalid proof will not change the state of the exchange. Note that proofs can
    ///      be submitted in a different order than the blocks themselves.
    ///
    ///      Multiple blocks can be verified at once (in any order) IF they use the same circuit.
    ///      This function will throw if blocks using different circuits need to be verified.
    ///
    ///      This method can only be called by the operator.
    ///
    /// @param blockIndices The 0-based index of the blocks to be verified with the given proofs
    /// @param proofs The ZK proof for all blockIndices (proofs.length % 8 == 0).
    function verifyBlocks(
        uint[] calldata blockIndices,
        uint[] calldata proofs
        )
        external;

    /// @dev Reverts the exchange's virtual blockchain until a specific block index.
    ///      Any non-finalized block can be reverted but there will be a fine in LRC.
    ///
    ///      This method can only be called by the operator when not in withdrawal mode.
    ///
    ///      In withdrawal mode anyone can call burnStake so the exchange still gets punished
    ///      for committing blocks it does not prove.
    ///
    /// @param blockIdx The 0-based index of the block that does not have a valid proof within
    ///        MAX_PROOF_GENERATION_TIME_IN_SECONDS seconds.
    function revertBlock(
        uint blockIdx
        )
        external;
}
