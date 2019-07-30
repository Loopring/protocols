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
import "../libexchange/ExchangeMode.sol";

import "./BaseBlockProcessor.sol";


/// @title OnChainWithdrawalBlock
/// @author Daniel Wang - <daniel@loopring.org>
/// @author Brecht Devos - <brecht@loopring.org>
contract OnChainWithdrawalBlock is BaseBlockProcessor
{
    using ExchangeMode      for ExchangeData.State;

    bool public supportOnChainDataAvailability = false;

    function commitBlock(
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
        uint32 numWithdrawalRequestsCommitted = prevBlock.numWithdrawalRequestsCommitted;


        require(startIdx == numWithdrawalRequestsCommitted, "INVALID_REQUEST_RANGE");
        require(count <= blockSize, "INVALID_REQUEST_RANGE");
        require(startIdx + count <= state.withdrawalChain.length, "INVALID_REQUEST_RANGE");

        if (state.isShutdown()) {
            require(count == 0, "INVALID_WITHDRAWAL_COUNT");
            // Don't check anything here, the operator can do all necessary withdrawals
            // in any order he wants (the circuit still ensures the withdrawals are valid)
        } else {
            require(count > 0, "INVALID_WITHDRAWAL_COUNT");
            bytes32 startingHash = state.withdrawalChain[startIdx - 1].accumulatedHash;
            bytes32 endingHash = state.withdrawalChain[startIdx + count - 1].accumulatedHash;
            // Pad the block so it's full
            for (uint i = count; i < blockSize; i++) {
                endingHash = sha256(
                    abi.encodePacked(
                        endingHash,
                        uint24(0),
                        uint8(0),
                        uint96(0)
                    )
                );
            }
            bytes32 inputStartingHash = 0x0;
            bytes32 inputEndingHash = 0x0;
            assembly {
                inputStartingHash := mload(add(data, 100))
                inputEndingHash := mload(add(data, 132))
            }
            require(inputStartingHash == startingHash, "INVALID_STARTING_HASH");
            require(inputEndingHash == endingHash, "INVALID_ENDING_HASH");
            numWithdrawalRequestsCommitted += uint32(count);
        }

        uint start = 4 + 32 + 32 + 32 + 32 + 4 + 4;
        uint length = 7 * blockSize;

        bytes memory withdrawals;
        assembly {
            withdrawals := add(data, start)
            mstore(withdrawals, length)
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
            prevBlock.numDepositRequestsCommitted,
            numWithdrawalRequestsCommitted,
            false,
            0,
            withdrawals
        );

        state.blocks.push(newBlock);
    }
}


