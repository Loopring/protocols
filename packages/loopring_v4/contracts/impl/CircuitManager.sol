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
pragma experimental ABIEncoderV2;

import "../lib/Claimable.sol";
import "../lib/ReentrancyGuard.sol";
import "../iface/ICircuitManager.sol";

import "../impl/CircuitData.sol";


/// @title CircuitManager
/// @author Brecht Devos - <brecht@loopring.org>
contract CircuitManager is Claimable, ReentrancyGuard, ICircuitManager
{
    struct CircuitState
    {
        bool registered;
        bool enabled;
        CircuitData.VerificationKey verificationKey;
    }

    mapping (bool => mapping (uint32 => mapping (uint16 => CircuitState))) public circuits;

    constructor() Claimable() public {}

    function getVerificationKey(
        CircuitData.Circuit memory circuit
        )
        public
        view
        returns (CircuitData.VerificationKey memory)
    {
        CircuitState storage circuitState = circuits[circuit.onchainDataAvailability][circuit.blockSize][circuit.version];
        require(circuitState.registered == true, "NOT_REGISTERED");
        return circuitState.verificationKey;
    }

    function registerCircuit(
        CircuitData.Circuit         memory circuit,
        CircuitData.VerificationKey memory verificationKey
        )
        public
        nonReentrant
        onlyOwner
    {
        CircuitState storage circuitState = circuits[circuit.onchainDataAvailability][circuit.blockSize][circuit.version];
        require(circuitState.registered == false, "ALREADY_REGISTERED");

        circuitState.verificationKey = verificationKey;
        circuitState.registered = true;
        circuitState.enabled = true;

        emit CircuitRegistered(
            circuit
        );
    }

    function disableCircuit(
        CircuitData.Circuit memory circuit
        )
        public
        nonReentrant
        onlyOwner
    {
        CircuitState storage circuitState = circuits[circuit.onchainDataAvailability][circuit.blockSize][circuit.version];
        require(circuitState.registered == true, "NOT_REGISTERED");
        require(circuitState.enabled == true, "ALREADY_DISABLED");

        circuitState.enabled = false;

        emit CircuitDisabled(
            circuit
        );
    }

    function isCircuitRegistered(
        CircuitData.Circuit memory circuit
        )
        public
        view
        returns (bool)
    {
        return circuits[circuit.onchainDataAvailability][circuit.blockSize][circuit.version].registered;
    }

    function isCircuitEnabled(
        CircuitData.Circuit memory circuit
        )
        public
        view
        returns (bool)
    {
        return circuits[circuit.onchainDataAvailability][circuit.blockSize][circuit.version].enabled;
    }
}