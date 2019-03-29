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

import "./ExchangeData.sol";
import "./ExchangeMode.sol";

import "../../lib/BurnableERC20.sol";
import "../../lib/ERC20SafeTransfer.sol";
import "../../lib/MathUint.sol";

/// @title ExchangeAccounts.
/// @author Daniel Wang  - <daniel@loopring.org>
/// @author Brecht Devos - <brecht@loopring.org>
library ExchangeBlocks
{
    using MathUint          for uint;
    using ExchangeMode      for ExchangeData.State;

    event BlockCommitted(
        uint blockIdx,
        bytes32 publicDataHash
    );

    event BlockFinalized(
        uint blockIdx
    );

    event Revert(
        uint blockIdx
    );

    function getBlockHeight(
        ExchangeData.State storage S
        )
        public
        view
        returns (uint)
    {
        return S.blocks.length - 1;
    }

    function commitBlock(
        ExchangeData.State storage S,
        uint blockType,
        bytes memory data
        )
        public
    {
        commitBlockInternal(S, blockType, data);
    }

    function commitBlockInternal(
        ExchangeData.State storage S,
        uint blockType,
        bytes memory data
        )
        internal
    {
        // Extract the exchange ID from the data
        uint32 exchangeIdInData = 0;
        assembly {
            exchangeIdInData := and(mload(add(data, 4)), 0xFFFFFFFF)
        }
        require(exchangeIdInData == S.id, "INVALID_ID");

        // TODO: Check if this exchange has a minimal amount of LRC staked?

        // Exchange cannot be in withdraw mode
        require(!S.isInWithdrawalMode(), "INVALID_MODE");

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
        uint32 numWithdrawRequestsCommitted = currentBlock.numWithdrawRequestsCommitted;

        // TODO: double check this logic
        // Check if the operator is forced to commit a deposit or withdraw block
        // We give priority to withdrawals. If a withdraw block is forced it needs to
        // be processed first, even if there is also a deposit block forced.
        if (blockType != uint(ExchangeData.BlockType.ONCHAIN_WITHDRAW) && isWithdrawRequestForced(S, numWithdrawRequestsCommitted)) {
            revert("BLOCK_COMMIT_FORCED");
        } else if (blockType != uint(ExchangeData.BlockType.DEPOSIT) && isDepositRequestForced(S, numDepositRequestsCommitted)) {
            revert("BLOCK_COMMIT_FORCED");
        }

        if (blockType == uint(ExchangeData.BlockType.SETTLEMENT)) {
            uint32 inputTimestamp;
            assembly {
                inputTimestamp := and(mload(add(data, 75)), 0xFFFFFFFF)
            }
            require(
                inputTimestamp > now - ExchangeData.TIMESTAMP_WINDOW_SIZE_IN_SECONDS() &&
                inputTimestamp < now + ExchangeData.TIMESTAMP_WINDOW_SIZE_IN_SECONDS(),
                "INVALID_TIMESTAMP"
            );
        } else if (blockType == uint(ExchangeData.BlockType.DEPOSIT)) {
            uint startIdx = 0;
            uint count = 0;
            assembly {
                startIdx := and(mload(add(data, 136)), 0xFFFFFFFF)
                count := and(mload(add(data, 140)), 0xFFFFFFFF)
            }
            require (startIdx == numDepositRequestsCommitted, "INVALID_DEPOSITREQUEST_RANGE");
            require (count <= ExchangeData.NUM_DEPOSITS_IN_BLOCK(), "INVALID_DEPOSITREQUEST_RANGE");
            require (startIdx + count <= S.depositChain.length, "INVALID_DEPOSITREQUEST_RANGE");

            bytes32 startingHash = S.depositChain[startIdx - 1].accumulatedHash;
            bytes32 endingHash = S.depositChain[startIdx + count - 1].accumulatedHash;
            // Pad the block so it's full
            for (uint i = count; i < ExchangeData.NUM_DEPOSITS_IN_BLOCK(); i++) {
                endingHash = sha256(
                    abi.encodePacked(
                        endingHash,
                        uint24(0),
                        ExchangeData.DEFAULT_ACCOUNT_PUBLICKEY_X(),
                        ExchangeData.DEFAULT_ACCOUNT_PUBLICKEY_Y(),
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
            require (startIdx == numWithdrawRequestsCommitted, "INVALID_WITHDRAWREQUEST_RANGE");
            require (count <= ExchangeData.NUM_WITHDRAWALS_IN_BLOCK(), "INVALID_WITHDRAWREQUEST_RANGE");
            require (startIdx + count <= S.withdrawalChain.length, "INVALID_WITHDRAWREQUEST_RANGE");

            bytes32 startingHash = S.withdrawalChain[startIdx - 1].accumulatedHash;
            bytes32 endingHash = S.withdrawalChain[startIdx + count - 1].accumulatedHash;
            // Pad the block so it's full
            for (uint i = count; i < ExchangeData.NUM_WITHDRAWALS_IN_BLOCK(); i++) {
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
        ExchangeData.Block memory newBlock = ExchangeData.Block(
            merkleRootAfter,
            publicDataHash,
            ExchangeData.BlockState.COMMITTED,
            uint32(now),
            numDepositRequestsCommitted,
            numWithdrawRequestsCommitted,
            false,
            (blockType == uint(ExchangeData.BlockType.ONCHAIN_WITHDRAW) ||
             blockType == uint(ExchangeData.BlockType.OFFCHAIN_WITHDRAW)) ? data : new bytes(0)
        );

        S.blocks.push(newBlock);

        emit BlockCommitted(S.blocks.length - 1, publicDataHash);
    }

    function verifyBlock(
        ExchangeData.State storage S,
        uint blockIdx,
        uint256[8] memory proof
        )
        public
    {
        // Exchange cannot be in withdraw mode
        require(!S.isInWithdrawalMode(), "INVALID_MODE");

        require(blockIdx < S.blocks.length, "INVALID_BLOCK_IDX");
        ExchangeData.Block storage specifiedBlock = S.blocks[blockIdx];
        require(specifiedBlock.state == ExchangeData.BlockState.COMMITTED, "BLOCK_VERIFIED_ALREADY");

        // require(
        //     IBlockVerifier(blockVerifierAddress).verifyProof(
        //         specifiedBlock.publicDataHash, proof
        //     ),
        //     "INVALID_PROOF"
        // );

        // Update state of this block and potentially the following blocks
        ExchangeData.Block storage previousBlock = S.blocks[blockIdx - 1];
        if (previousBlock.state == ExchangeData.BlockState.FINALIZED) {
            specifiedBlock.state = ExchangeData.BlockState.FINALIZED;
            emit BlockFinalized(blockIdx);
            // The next blocks could become finalized as well so check this now
            // The number of blocks after the specified block index is limited
            // so we don't have to worry about running out of gas in this loop
            uint nextBlockIdx = blockIdx + 1;
            while (nextBlockIdx < S.blocks.length &&
                S.blocks[nextBlockIdx].state == ExchangeData.BlockState.VERIFIED) {

                S.blocks[nextBlockIdx].state = ExchangeData.BlockState.FINALIZED;
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
        require(blockIdx < S.blocks.length, "INVALID_BLOCK_IDX");
        ExchangeData.Block storage specifiedBlock = S.blocks[blockIdx];
        require(specifiedBlock.state == ExchangeData.BlockState.COMMITTED, "INVALID_BLOCK_STATE");

        // The specified block needs to be the first block not finalized
        // (this way we always revert to a guaranteed valid block and don't need to revert multiple times)
        ExchangeData.Block storage previousBlock = S.blocks[uint(blockIdx).sub(1)];
        require(previousBlock.state == ExchangeData.BlockState.FINALIZED, "BLOCK_NOT_FINALIZED");

        // Check if this block is verified too late
        require(
            now > specifiedBlock.timestamp + ExchangeData.MAX_PROOF_GENERATION_TIME_IN_SECONDS(),
            "TOO_LATE_PROOF"
        );

        // TODO: - burn stake amount of Exchange
        //       - store info somewhere in Exchange contract what block was reverted so
        //       - the ExchangeOwner can punish the operator that submitted the block

        // Remove all blocks after and including blockIdx
        S.blocks.length = blockIdx;

        emit Revert(blockIdx);
    }

    // == Internal Functions ==
    function isDepositRequestForced(
        ExchangeData.State storage S,
        uint32 depositRequestIdx
        )
        internal
        view
        returns (bool)
    {
        if (depositRequestIdx < S.depositChain.length) {
            return S.depositChain[depositRequestIdx].timestamp < now.sub(ExchangeData.MAX_AGE_REQUEST_UNTIL_FORCED());
        } else {
            return false;
        }
    }

    function isWithdrawRequestForced(
        ExchangeData.State storage S,
        uint32 withdrawRequestIdx
        )
        internal
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