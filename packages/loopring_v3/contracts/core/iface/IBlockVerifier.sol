// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../lib/Claimable.sol";


/// @title IBlockVerifier
/// @author Brecht Devos - <brecht@loopring.org>
abstract contract IBlockVerifier is Claimable
{
    // -- Events --

    event CircuitRegistered(
        uint8  indexed blockType,
        uint16         blockSize,
        uint8          blockVersion
    );

    event CircuitDisabled(
        uint8  indexed blockType,
        uint16         blockSize,
        uint8          blockVersion
    );

    // -- Public functions --

    /// @dev Sets the verifying key for the specified circuit.
    ///      Every block permutation needs its own circuit and thus its own set of
    ///      verification keys. Only a limited number of block sizes per block
    ///      type are supported.
    /// @param blockType The type of the block
    /// @param blockSize The number of requests handled in the block
    /// @param blockVersion The block version (i.e. which circuit version needs to be used)
    /// @param vk The verification key
    function registerCircuit(
        uint8    blockType,
        uint16   blockSize,
        uint8    blockVersion,
        uint[18] calldata vk
        )
        external
        virtual;

    /// @dev Disables the use of the specified circuit.
    /// @param blockType The type of the block
    /// @param blockSize The number of requests handled in the block
    /// @param blockVersion The block version (i.e. which circuit version needs to be used)
    function disableCircuit(
        uint8  blockType,
        uint16 blockSize,
        uint8  blockVersion
        )
        external
        virtual;

    /// @dev Verifies blocks with the given public data and proofs.
    ///      Verifying a block makes sure all requests handled in the block
    ///      are correctly handled by the operator.
    /// @param blockType The type of block
    /// @param blockSize The number of requests handled in the block
    /// @param blockVersion The block version (i.e. which circuit version needs to be used)
    /// @param publicInputs The hash of all the public data of the blocks
    /// @param proofs The ZK proofs proving that the blocks are correct
    /// @return True if the block is valid, false otherwise
    function verifyProofs(
        uint8  blockType,
        uint16 blockSize,
        uint8  blockVersion,
        uint[] calldata publicInputs,
        uint[] calldata proofs
        )
        external
        virtual
        view
        returns (bool);

    /// @dev Checks if a circuit with the specified parameters is registered.
    /// @param blockType The type of the block
    /// @param blockSize The number of requests handled in the block
    /// @param blockVersion The block version (i.e. which circuit version needs to be used)
    /// @return True if the circuit is registered, false otherwise
    function isCircuitRegistered(
        uint8  blockType,
        uint16 blockSize,
        uint8  blockVersion
        )
        external
        virtual
        view
        returns (bool);

    /// @dev Checks if a circuit can still be used to commit new blocks.
    /// @param blockType The type of the block
    /// @param blockSize The number of requests handled in the block
    /// @param blockVersion The block version (i.e. which circuit version needs to be used)
    /// @return True if the circuit is enabled, false otherwise
    function isCircuitEnabled(
        uint8  blockType,
        uint16 blockSize,
        uint8  blockVersion
        )
        external
        virtual
        view
        returns (bool);
}
