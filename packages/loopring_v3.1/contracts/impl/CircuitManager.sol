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

import "../lib/Claimable.sol";
import "../lib/ReentrancyGuard.sol";

import "../iface/ICircuitManager.sol";

/// @title CircuitManager
/// @author Brecht Devos - <brecht@loopring.org>
contract CircuitManager is  Claimable, ReentrancyGuard, ICircuitManager
{
    struct Circuit
    {
        bool registered;
        bool enabled;
        uint[18] verificationKey;
    }

    mapping (bool => mapping (uint32 => mapping (uint16 => Circuit))) public circuits;

    constructor() Claimable() public {}

    function getVerificationKey(
        bool   onchainDataAvailability,
        uint32 blockSize,
        uint16 blockVersion
        )
        external
        view
        returns (uint[18] memory)
    {
        Circuit storage circuit = circuits[onchainDataAvailability][blockSize][blockVersion];
        require(circuit.registered == true, "NOT_REGISTERED");
        return circuit.verificationKey;
    }

    function registerCircuit(
        bool     onchainDataAvailability,
        uint32   blockSize,
        uint16   blockVersion,
        uint[18] calldata vk
        )
        external
        nonReentrant
        onlyOwner
    {
        Circuit storage circuit = circuits[onchainDataAvailability][blockSize][blockVersion];
        require(circuit.registered == false, "ALREADY_REGISTERED");

        for (uint i = 0; i < 18; i++) {
            circuit.verificationKey[i] = vk[i];
        }
        circuit.registered = true;
        circuit.enabled = true;

        emit CircuitRegistered(
            onchainDataAvailability,
            blockSize,
            blockVersion
        );
    }

    function disableCircuit(
        bool   onchainDataAvailability,
        uint32 blockSize,
        uint16 blockVersion
        )
        external
        nonReentrant
        onlyOwner
    {
        Circuit storage circuit = circuits[onchainDataAvailability][blockSize][blockVersion];
        require(circuit.registered == true, "NOT_REGISTERED");
        require(circuit.enabled == true, "ALREADY_DISABLED");

        circuit.enabled = false;

        emit CircuitDisabled(
            onchainDataAvailability,
            blockSize,
            blockVersion
        );
    }

    function isCircuitRegistered(
        bool   onchainDataAvailability,
        uint32 blockSize,
        uint16 blockVersion
        )
        external
        view
        returns (bool)
    {
        return circuits[onchainDataAvailability][blockSize][blockVersion].registered;
    }

    function isCircuitEnabled(
        bool   onchainDataAvailability,
        uint32 blockSize,
        uint16 blockVersion
        )
        external
        view
        returns (bool)
    {
        return circuits[onchainDataAvailability][blockSize][blockVersion].enabled;
    }
}