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


/// @title IOffchainDataExtention
/// @author Daniel Wang  - <daniel@loopring.org>
/// @dev Implement this interface to publish offchain data for a block.
interface IOffchainDataExtention
{
    /// @dev Publish the offchain data for the given block.
    /// @param merkleRoot The Merkle root for of this block
    /// @param offchainData Arbitrary data associate with off-chain data-availability.
    function publish(
        bytes32 merkleRoot,
        bytes   calldata offchainData
        )
        external;
}