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

import "../thirdparty/Verifier.sol";
import "../thirdparty/BatchVerifier.sol";

import "../lib/ReentrancyGuard.sol";

import "../iface/IBlockVerifier.sol";

import "../impl/libexchange/ExchangeData.sol";


/// @title An Implementation of IBlockVerifier.
/// @author Brecht Devos - <brecht@loopring.org>
contract BlockVerifier is ReentrancyGuard, IBlockVerifier
{
    struct Circuit
    {
        bool registered;
        bool enabled;
        uint[18] verificationKey;
    }

    mapping (bool => mapping (uint8 => mapping (uint16 => mapping (uint8 => Circuit)))) public circuits;

    constructor() Claimable() public {}

    function registerCircuit(
        uint8    blockType,
        bool     onchainDataAvailability,
        uint16   blockSize,
        uint8    blockVersion,
        uint[18] calldata vk
        )
        external
        nonReentrant
        onlyOwner
    {
        bool dataAvailability = needsDataAvailability(blockType, onchainDataAvailability);
        require(dataAvailability == onchainDataAvailability, "NO_DATA_AVAILABILITY_NEEDED");
        Circuit storage circuit = circuits[onchainDataAvailability][blockType][blockSize][blockVersion];
        require(circuit.registered == false, "ALREADY_REGISTERED");

        for (uint i = 0; i < 18; i++) {
            circuit.verificationKey[i] = vk[i];
        }
        circuit.registered = true;
        circuit.enabled = true;

        emit CircuitRegistered(
            blockType,
            onchainDataAvailability,
            blockSize,
            blockVersion
        );
    }

    function disableCircuit(
        uint8  blockType,
        bool   onchainDataAvailability,
        uint16 blockSize,
        uint8  blockVersion
        )
        external
        nonReentrant
        onlyOwner
    {
        Circuit storage circuit = circuits[onchainDataAvailability][blockType][blockSize][blockVersion];
        require(circuit.registered == true, "NOT_REGISTERED");
        require(circuit.enabled == true, "ALREADY_DISABLED");

        circuit.enabled = false;

        emit CircuitDisabled(
            blockType,
            onchainDataAvailability,
            blockSize,
            blockVersion
        );
    }

    function verifyProofs(
        uint8  blockType,
        bool   onchainDataAvailability,
        uint16 blockSize,
        uint8  blockVersion,
        uint[] calldata publicInputs,
        uint[] calldata proofs
        )
        external
        view
        returns (bool)
    {
        bool dataAvailability = needsDataAvailability(blockType, onchainDataAvailability);
        Circuit storage circuit = circuits[dataAvailability][blockType][blockSize][blockVersion];
        require(circuit.registered == true, "NOT_REGISTERED");

        uint[18] storage vk = circuit.verificationKey;
        uint[14] memory _vk = [
            vk[0], vk[1], vk[2], vk[3], vk[4], vk[5], vk[6],
            vk[7], vk[8], vk[9], vk[10], vk[11], vk[12], vk[13]
        ];
        uint[4] memory _vk_gammaABC = [vk[14], vk[15], vk[16], vk[17]];

        if (publicInputs.length == 1) {
            return Verifier.Verify(_vk, _vk_gammaABC, proofs, publicInputs);
        } else {
            return BatchVerifier.BatchVerify(
                _vk,
                _vk_gammaABC,
                proofs,
                publicInputs,
                publicInputs.length
            );
        }
    }

    function isCircuitRegistered(
        uint8  blockType,
        bool   onchainDataAvailability,
        uint16 blockSize,
        uint8  blockVersion
        )
        external
        view
        returns (bool)
    {
        bool dataAvailability = needsDataAvailability(blockType, onchainDataAvailability);
        return circuits[dataAvailability][blockType][blockSize][blockVersion].registered;
    }

    function isCircuitEnabled(
        uint8  blockType,
        bool   onchainDataAvailability,
        uint16 blockSize,
        uint8  blockVersion
        )
        external
        view
        returns (bool)
    {
        bool dataAvailability = needsDataAvailability(blockType, onchainDataAvailability);
        return circuits[dataAvailability][blockType][blockSize][blockVersion].enabled;
    }

    function needsDataAvailability(
        uint8 blockType,
        bool  onchainDataAvailability
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
