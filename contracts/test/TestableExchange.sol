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

import "../impl/Exchange.sol";


/// @author Brecht Devos - <brecht@loopring.org>
contract TestableExchange is Exchange
{
    uint256[14] vk;
    uint256[] gammaABC;

    constructor(
        address _tradeDelegateAddress
        )
        Exchange(_tradeDelegateAddress)
        public
    {
        // Empty
    }


    function testVerify(
        uint256[14] memory _vk,
        uint256[] memory _vk_gammaABC,
        uint256[8] memory _proof,
        uint256[] memory _publicInputs
        )
        public
        view
        returns (bool)
    {
        return Verifier.Verify(_vk, _vk_gammaABC, _proof, _publicInputs);
    }


    function getVerifyingKey()
        public
        view
        returns (uint256[14] memory out_vk, uint256[] memory out_gammaABC)
    {
        return (vk, gammaABC);
    }

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