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

import "../iface/IExchange.sol";
import "../iface/ITradeDelegate.sol";

import "../lib/Verifier.sol";

import "../lib/BytesUtil.sol";
import "../lib/MathUint.sol";
import "../lib/NoDefaultFunc.sol";


/// @title An Implementation of IExchange.
/// @author Brecht Devos - <brecht@loopring.org>,
contract Exchange is IExchange, NoDefaultFunc {
    using MathUint      for uint;
    using BytesUtil     for bytes;

    address public  tradeDelegateAddress        = address(0x0);

    bytes32 public merkleRoot                   = 0x056e110222a84609de5696e61a9f18731afd9c4743f77d85c6f7267cb1617571;

    uint256[14] vk;
    uint256[] gammaABC;

    constructor(
        address _tradeDelegateAddress
        )
        public
    {
        require(_tradeDelegateAddress != address(0x0), ZERO_ADDRESS);

        tradeDelegateAddress = _tradeDelegateAddress;
    }

    function submitRings(
        bytes calldata data,
        uint256[8] calldata proof
        )
        external
    {
        bytes32 publicDataHash = sha256(data);
        bool verified = verifyProof(merkleRoot, publicDataHash, proof);
        require(verified, "INVALID_PROOF");

        doTokenTransfers(data);
    }

    function verifyProof(
        bytes32 _merkleRoot,
        bytes32 _publicDataHash,
        uint256[8] memory proof
        )
        internal
        view
        returns (bool)
    {
        uint256[] memory publicInputs = new uint256[](2);
        publicInputs[0] = uint256(_merkleRoot);
        publicInputs[1] = uint256(_publicDataHash);

        uint256[14] memory vk;
        uint256[] memory vk_gammaABC;
        (vk, vk_gammaABC) = getVerifyingKey();

        return Verifier.Verify(vk, vk_gammaABC, proof, publicInputs);
    }

    function doTokenTransfers(
        bytes memory data
        )
        internal
        view
    {
        ITradeDelegate tradeDelegate = ITradeDelegate(tradeDelegateAddress);
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
