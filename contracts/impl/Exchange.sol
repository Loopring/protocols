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
        bytes memory data,
        uint256[8] memory proof
        )
        public
    {
        // TODO: don't send merkleRootBefore to save on calldata
        bytes32 merkleRootBefore;
        bytes32 merkleRootAfter;
        assembly {
            merkleRootBefore := mload(add(data, 32))
            merkleRootAfter := mload(add(data, 64))
        }
        require(merkleRootBefore == merkleRoot, "INVALID_ROOT");

        bytes32 publicDataHash = sha256(data);
        bool verified = verifyProof(publicDataHash, proof);
        require(verified, "INVALID_PROOF");

        // Update the merkle root
        merkleRoot = merkleRootAfter;

        doTokenTransfers(data);
    }

    function verifyProof(
        bytes32 _publicDataHash,
        uint256[8] memory proof
        )
        internal
        view
        returns (bool)
    {
        uint256[] memory publicInputs = new uint256[](1);
        publicInputs[0] = uint256(_publicDataHash);

        uint256[14] memory _vk;
        uint256[] memory _vk_gammaABC;
        (_vk, _vk_gammaABC) = getVerifyingKey();

        return Verifier.Verify(_vk, _vk_gammaABC, proof, publicInputs);
    }

    function doTokenTransfers(
        bytes memory data
        )
        internal
    {
        uint numTransfers = (data.length - (32 * 2)) / (20 + 20 + 20 + 16);

        uint ptr;
        assembly {
            ptr := add(data, 64)
        }

        bytes32[] memory transferData = new bytes32[](numTransfers * 4);
        for (uint i = 0; i < numTransfers; i++) {
            bytes32 token;
            bytes32 from;
            bytes32 to;
            bytes32 amount;
            assembly {
                token := and(mload(add(ptr, 20)), 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
                from := and(mload(add(ptr, 40)), 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
                to := and(mload(add(ptr, 60)), 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
                amount := and(mload(add(ptr, 76)), 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
            }
            transferData[i*4 + 0] = token;
            transferData[i*4 + 1] = from;
            transferData[i*4 + 2] = to;
            transferData[i*4 + 3] = amount;

            ptr += (20 + 20 + 20 + 16);
        }
        ITradeDelegate(tradeDelegateAddress).batchTransfer(transferData);
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
