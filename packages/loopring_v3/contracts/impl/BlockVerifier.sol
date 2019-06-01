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

import "../iface/IBlockVerifier.sol";

import "../lib/Claimable.sol";

import "../impl/libexchange/ExchangeData.sol";

import "../thirdparty/Verifier.sol";


/// @title An Implementation of IBlockVerifier.
/// @author Brecht Devos - <brecht@loopring.org>,
contract BlockVerifier is IBlockVerifier, Claimable
{
    mapping (bool => mapping (uint8 => mapping (uint16 => uint256[18]))) verificationKeys;

    function setVerifyingKey(
        uint8 blockType,
        bool onchainDataAvailability,
        uint16 blockSize,
        uint256[18] calldata vk
        )
        external
        onlyOwner
    {
        // While vk[0] could be 0, we don't allow it so we can use this to easily check
        // if the verification key is set
        require(vk[0] != 0, "INVALID_DATA");
        bool dataAvailability = needsDataAvailability(blockType, onchainDataAvailability);
        require(dataAvailability == onchainDataAvailability, "NO_DATA_AVAILABILITY_NEEDED");
        for (uint i = 0; i < 18; i++) {
            verificationKeys[onchainDataAvailability][blockType][blockSize][i] = vk[i];
        }
    }

    function canVerify(
        uint8 blockType,
        bool onchainDataAvailability,
        uint16 blockSize
        )
        external
        view
        returns (bool)
    {
        bool dataAvailability = needsDataAvailability(blockType, onchainDataAvailability);
        return verificationKeys[dataAvailability][blockType][blockSize][0] != 0;
    }

    function verifyProof(
        uint8 blockType,
        bool onchainDataAvailability,
        uint16 blockSize,
        bytes32 publicDataHash,
        uint256[8] calldata proof
        )
        external
        view
        returns (bool)
    {
        bool dataAvailability = needsDataAvailability(blockType, onchainDataAvailability);
        uint256[18] storage vk = verificationKeys[dataAvailability][blockType][blockSize];

        uint256[14] memory _vk = [
            vk[0], vk[1], vk[2], vk[3], vk[4], vk[5], vk[6],
            vk[7], vk[8], vk[9], vk[10], vk[11], vk[12], vk[13]
        ];
        uint256[4] memory _vk_gammaABC = [vk[14], vk[15], vk[16], vk[17]];
        uint256[1] memory publicInputs = [uint256(publicDataHash)];

        return Verifier.Verify(_vk, _vk_gammaABC, proof, publicInputs);
    }

    function needsDataAvailability(
        uint8 blockType,
        bool onchainDataAvailability
        )
        internal
        pure
        returns (bool)
    {
        // On-chain requests never need data-availability
        return (
            (blockType == uint(ExchangeData.BlockType.DEPOSIT)) ||
            (blockType == uint(ExchangeData.BlockType.ONCHAIN_WITHDRAWAL))
            ? false : onchainDataAvailability
        );
    }
}
