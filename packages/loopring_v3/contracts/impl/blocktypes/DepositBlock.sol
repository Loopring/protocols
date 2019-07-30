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

import "../libexchange/ExchangeData.sol";

import "./BaseBlockProcessor.sol";


/// @title DepositBlock
/// @author Daniel Wang - <daniel@loopring.org>
/// @author Brecht Devos - <brecht@loopring.org>
contract DepositBlock is BaseBlockProcessor
{
    bool public supportOnChainDataAvailability = false;

    function processBlock(
        uint8   blockType,
        uint16  blockSize,
        uint8   blockVersion,
        bytes32 publicDataHash,
        bytes32 merkleRootAfter,
        bytes   memory data // decompressed
        )
        public
    {
        uint startIdx = 0;
        uint count = 0;
        assembly {
            startIdx := and(mload(add(data, 136)), 0xFFFFFFFF)
            count := and(mload(add(data, 140)), 0xFFFFFFFF)
        }

        ExchangeData.Block storage prevBlock = state.blocks[state.blocks.length - 1];
        uint32 numDepositRequestsCommitted = prevBlock.numDepositRequestsCommitted;

        require(startIdx == numDepositRequestsCommitted, "INVALID_REQUEST_RANGE");
        require(count <= blockSize, "INVALID_REQUEST_RANGE");
        require(startIdx + count <= state.depositChain.length, "INVALID_REQUEST_RANGE");

        bytes32 startingHash = state.depositChain[startIdx - 1].accumulatedHash;
        bytes32 endingHash = state.depositChain[startIdx + count - 1].accumulatedHash;
        // Pad the block so it's full
        for (uint i = count; i < blockSize; i++) {
            endingHash = sha256(
                abi.encodePacked(
                    endingHash,
                    uint24(0),
                    uint(0),
                    uint(0),
                    uint8(0),
                    uint96(0)
                )
            );
        }

        bytes32 inputHash = 0x0;
        assembly {
            inputHash := mload(add(data, 100))
        }
        require(inputHash == startingHash, "INVALID_STARTING_HASH");

        assembly {
            inputHash := mload(add(data, 132))
        }
        require(inputHash == endingHash, "INVALID_ENDING_HASH");

        // Create a new block with the updated merkle roots
        ExchangeData.Block memory newBlock = ExchangeData.Block(
            merkleRootAfter,
            publicDataHash,
            ExchangeData.BlockState.COMMITTED,
            blockType,
            blockSize,
            blockVersion,
            uint32(now),
            numDepositRequestsCommitted + uint32(count),
            prevBlock.numWithdrawalRequestsCommitted,
            false,
            0,
            new bytes(0)
        );

        state.blocks.push(newBlock);
    }
}


