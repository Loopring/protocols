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

import "../iface/IBlockVerifier.sol";

import "../lib/NoDefaultFunc.sol";

import "../thirdparty/Verifier.sol";


/// @title An Implementation of IBlockVerifier.
/// @author Brecht Devos - <brecht@loopring.org>,
contract BlockVerifier is IBlockVerifier, NoDefaultFunc
{
    uint256[14] vk;
    uint256[] gammaABC;

    function canVerify(
        uint8/* blockType*/,
        uint16/* numElements*/
        )
        external
        view
        returns (bool)
    {
        // TODO
        return true;
    }

    function verifyProof(
        uint8/* blockType*/,
        uint16/* numElements*/,
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
        uint256[] memory _vk_gammaABC;
        (_vk, _vk_gammaABC) = getVerifyingKey();

        // Q(dongw): can we use `vk` and `grammaABC` directly here?
        return Verifier.Verify(_vk, _vk_gammaABC, proof, publicInputs);
    }

    function getVerifyingKey()
        public
        view
        returns (uint256[14] memory out_vk, uint256[] memory out_gammaABC)
    {
        return (vk, gammaABC);
    }


    // Q(dongw): should this be permissioned?
    function setVerifyingKey(
        uint256[14] memory _vk,
        uint256[] memory _gammaABC
        )
        public
    {
        vk = _vk;
        gammaABC = _gammaABC;
    }
}
