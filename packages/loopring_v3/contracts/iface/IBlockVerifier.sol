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


/// @title IBlockVerifier
/// @author Brecht Devos - <brecht@loopring.org>
contract IBlockVerifier
{

    // TODO(brecht): document these two methods.
    function canVerify(
        uint8 blockType,
        bool onchainDataAvailability,
        uint16 numElements
        )
        external
        view
        returns (bool);

    function verifyProof(
        uint8 blockType,
        bool onchainDataAvailability,
        uint16 numElements,
        bytes32 publicDataHash,
        uint256[8] calldata proof
        )
        external
        view
        returns (bool);

}
