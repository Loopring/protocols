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

import "../lib/Ownable.sol";
import "../impl/libexchange/ExchangeData.sol";

import "../thirdparty/Verifier.sol";


/// @title An Implementation of IBlockVerifier.
/// @author Brecht Devos - <brecht@loopring.org>,
contract BlockVerifier is IBlockVerifier, Ownable
{
    mapping (bool => mapping (uint8 => mapping (uint16 => uint256[18]))) verificationKeys;

    function setVerifyingKey(
        uint8 blockType,
        bool onchainDataAvailability,
        uint16 numElements,
        uint256[18] calldata _vk
        )
        external
        onlyOwner
    {
        // While _vk[0] could be 0, we don't allow it so we can use this to easily check
        // if the verification key is set
        require(_vk[0] != 0, "INVALID_DATA");
        bool dataAvailability = needsDataAvailability(blockType, onchainDataAvailability);
        require(dataAvailability == onchainDataAvailability, "NO_DATA_AVAILABILITY_NEEDED");
        for (uint i = 0; i < 18; i++) {
            verificationKeys[onchainDataAvailability][blockType][numElements][i] = _vk[i];
        }
    }

    function canVerify(
        uint8 blockType,
        bool onchainDataAvailability,
        uint16 numElements
        )
        external
        view
        returns (bool)
    {
        bool dataAvailability = needsDataAvailability(blockType, onchainDataAvailability);
        return verificationKeys[dataAvailability][blockType][numElements][0] != 0;
    }

    function verifyProof(
        uint8 blockType,
        bool onchainDataAvailability,
        uint16 numElements,
        bytes32 publicDataHash,
        uint256[8] calldata proof
        )
        external
        view
        returns (bool)
    {
        uint256[] memory publicInputs = new uint256[](1);
        publicInputs[0] = uint256(publicDataHash);

        uint256[14] memory _vk;
        uint256[] memory _vk_gammaABC = new uint[](4);
        bool dataAvailability = needsDataAvailability(blockType, onchainDataAvailability);
        uint256[18] storage verificationKey = verificationKeys[dataAvailability][blockType][numElements];
        for (uint i = 0; i < 14; i++) {
            _vk[i] = verificationKey[i];
        }
        _vk_gammaABC[0] = verificationKey[14];
        _vk_gammaABC[1] = verificationKey[15];
        _vk_gammaABC[2] = verificationKey[16];
        _vk_gammaABC[3] = verificationKey[17];

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
