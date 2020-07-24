// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.6.10;
pragma experimental ABIEncoderV2;

import "../lib/Claimable.sol";


/// @title IBlockVerifier
/// @author Brecht Devos - <brecht@loopring.org>
abstract contract IBlockVerifier is Claimable
{
    // -- Events --
    struct CircuitKey
    {
        uint8    accountTreeDepth;
        uint8    blockType;
        bool     rollupMode;
        uint16   blockSize;
        uint8    blockVersion;
    }

    event CircuitRegistered(
        uint8  indexed accountTreeDepth,
        uint8  indexed blockType,
        bool           rollupMode,
        uint16         blockSize,
        uint8          blockVersion
    );

    event CircuitDisabled(
        uint8  indexed accountTreeDepth,
        uint8  indexed blockType,
        bool           rollupMode,
        uint16         blockSize,
        uint8          blockVersion
    );

    // -- Public functions --

    /// @dev Sets the verifying key for the specified circuit.
    ///      Every block permutation needs its own circuit and thus its own set of
    ///      verification keys. Only a limited number of block sizes per block
    ///      type are supported.
    /// @param key The key for the circuit.
    /// @param vk The verification key
    function registerCircuit(
        CircuitKey calldata key,
        uint[18] calldata vk
        )
        external
        virtual;

    /// @dev Disables the use of the specified circuit.
    ///      This will stop NEW blocks from using the given circuit, blocks that were already committed
    ///      can still be verified.
    /// @param key The key for the circuit.
    function disableCircuit(
        CircuitKey calldata key
        )
        external
        virtual;

    /// @dev Verifies blocks with the given public data and proofs.
    ///      Verifying a block makes sure all requests handled in the block
    ///      are correctly handled by the operator.
    /// @param key The key for the circuit.
    /// @param publicInputs The hash of all the public data of the blocks
    /// @param proofs The ZK proofs proving that the blocks are correct
    /// @return True if the block is valid, false otherwise
    function verifyProofs(
        CircuitKey calldata key,
        uint[] calldata publicInputs,
        uint[] calldata proofs
        )
        external
        virtual
        view
        returns (bool);

    /// @dev Checks if a circuit with the specified parameters is registered.
    /// @param key The key for the circuit.
    /// @return True if the circuit is registered, false otherwise
    function isCircuitRegistered(
        CircuitKey calldata key
        )
        external
        virtual
        view
        returns (bool);

    /// @dev Checks if a circuit can still be used to commit new blocks.
    /// @param key The key for the circuit.
    /// @return True if the circuit is enabled, false otherwise
    function isCircuitEnabled(
        CircuitKey calldata key
        )
        external
        virtual
        view
        returns (bool);
}
