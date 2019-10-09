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


/// @title  IVerificationKeyProvider
/// @author Brecht Devos - <brecht@loopring.org>
contract IVerificationKeyProvider
{
    /// @dev Returns the verificatin key of the specified block type.
    /// @param onchainDataAvailability True if the block expects onchain
    ///        data availability data as public input, false otherwise
    /// @param blockSize The number of requests handled in the block
    /// @param blockVersion The block version (i.e. which circuit version needs to be used)
    /// @return The verification key of the specified circuit
    function getVerificationKey(
        bool   onchainDataAvailability,
        uint32 blockSize,
        uint16 blockVersion
        )
        external
        view
        returns (uint[18] memory);

    /// @dev Checks if a circuit can still be used to commit new blocks.
    /// @param onchainDataAvailability True if the block expects onchain
    ///        data availability data as public input, false otherwise
    /// @param blockSize The number of requests handled in the block
    /// @param blockVersion The block version (i.e. which circuit version needs to be used)
    /// @return True if the circuit is enabled, false otherwise
    function isCircuitEnabled(
        bool   onchainDataAvailability,
        uint32 blockSize,
        uint16 blockVersion
        )
        external
        view
        returns (bool);
}
