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

import "./IVerificationKeyProvider.sol";

import "../impl/CircuitData.sol";


/// @title ICircuitManager
/// @author Brecht Devos - <brecht@loopring.org>
contract ICircuitManager is IVerificationKeyProvider
{
    // -- Events --

    event CircuitRegistered(
        CircuitData.Circuit
    );

    event CircuitDisabled(
        CircuitData.Circuit
    );

    // -- Public functions --

    /// @dev Sets the verifying key for the specified circuit.
    ///      Every block permutation needs its own circuit and thus its own set of
    ///      verification keys. Only a limited number of block sizes per block
    ///      type are supported.
    /// @param circuit The circuit
    /// @param vk The verification key
    function registerCircuit(
        CircuitData.Circuit         memory circuit,
        CircuitData.VerificationKey memory vk
        )
        public;

    /// @dev Disables the use of the specified circuit.
    ///      This will stop NEW blocks from using the given circuit, blocks that were already committed
    ///      can still be verified.
    /// @param circuit The circuit
    function disableCircuit(
        CircuitData.Circuit memory circuit
        )
        public;

    /// @dev Checks if a circuit with the specified parameters is registered.
    /// @param circuit The circuit
    /// @return True if the circuit is registered, false otherwise
    function isCircuitRegistered(
        CircuitData.Circuit memory circuit
        )
        public
        view
        returns (bool);
}
