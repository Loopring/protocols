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

import "../libexchange/ExchangeData.sol";

/// @title IBlockProcessor
/// @author Freeman Zhong - <kongliang@loopring.org>
contract OnchainWithdrawalProcessor
{

    function processBlock(
        ExchangeData.State calldata S,
        ExchangeData.Block calldata newBlock,
        bytes calldata data
        )
        external
    {
        uint numWithdrawalRequestsCommitted = newBlock.numWithdrawalRequestsCommitted;
        uint blockSize = newBlock.blockSize;

        uint startIdx = 0;
        uint count = 0;
        assembly {
            startIdx := and(mload(add(data, 136)), 0xFFFFFFFF)
            count := and(mload(add(data, 140)), 0xFFFFFFFF)
        }
        require (startIdx == numWithdrawalRequestsCommitted, "INVALID_REQUEST_RANGE");
        require (count <= blockSize, "INVALID_REQUEST_RANGE");
        require (startIdx + count <= S.withdrawalChain.length, "INVALID_REQUEST_RANGE");

        if (S.isShutdown()) {
            require (count == 0, "INVALID_WITHDRAWAL_COUNT");
            // Don't check anything here, the operator can do all necessary withdrawals
            // in any order he wants (the circuit still ensures the withdrawals are valid)
        } else {
            require (count > 0, "INVALID_WITHDRAWAL_COUNT");
            bytes32 startingHash = S.withdrawalChain[startIdx - 1].accumulatedHash;
            bytes32 endingHash = S.withdrawalChain[startIdx + count - 1].accumulatedHash;
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

        bytes memory withdrawals = new bytes(0);
        uint start = 4 + 32 + 32;
        start += 32 + 32 + 4 + 4;
        uint length = 7 * blockSize;
        assembly {
            withdrawals := add(data, start)
            mstore(withdrawals, length)
        }

        newBlock.withdrawals = withdrawals;
    }

}
