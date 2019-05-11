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


/// @title IBlockVerifier
/// @author Brecht Devos - <brecht@loopring.org>
contract IBlockVerifier
{
    /// @dev Sets or updates the verifying key for the given block type
    ///      and permutation.
    /// @param blockType The type of the block See @BlockType
    /// @param onchainDataAvailability True if the block expects onchain
    ///        data availability data as public input, false otherwise
    /// @param blockSize The number of requests handled in the block
    /// @param vk The verification key
    function setVerifyingKey(
        uint8 blockType,
        bool onchainDataAvailability,
        uint16 blockSize,
        uint256[18] calldata vk
        )
        external;

    /// @dev Checks if a block with the given parameters can be verified.
    ///      Every block permutation needs its own circuit and thus its own set of
    ///      verification keys. Only a limited number of blocks sizes per block
    ///      type are supported.
    /// @param blockType The type of the block See @BlockType
    /// @param onchainDataAvailability True if the block expects onchain
    ///        data availability data as public input, false otherwise
    /// @param blockSize The number of requests handled in the block
    /// @return True if the block can be verified, false otherwise
    function canVerify(
        uint8 blockType,
        bool onchainDataAvailability,
        uint16 blockSize
        )
        external
        view
        returns (bool);

    /// @dev Verifies a block with the given public data and proof.
    ///      Verifying a block makes sure all requests handled in the block
    ///      are correctly handled by the operator.
    /// @param blockType The type of block See @BlockType
    /// @param onchainDataAvailability True if the block expects onchain
    ///        data availability data as public input, false otherwise
    /// @param blockSize The number of requests handled in the block
    /// @param publicDataHash The hash of all the public data
    /// @param proof The ZK proof that the block is correct
    /// @return True if the block is valid, false otherwise
    function verifyProof(
        uint8 blockType,
        bool onchainDataAvailability,
        uint16 blockSize,
        bytes32 publicDataHash,
        uint256[8] calldata proof
        )
        external
        view
        returns (bool);

}
