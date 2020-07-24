// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.6.10;
pragma experimental ABIEncoderV2;

import "../thirdparty/Verifier.sol";
import "../thirdparty/BatchVerifier.sol";

import "../lib/ReentrancyGuard.sol";

import "../iface/IBlockVerifier.sol";
import "../iface/ExchangeData.sol";


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

    mapping (bytes32 => Circuit) public circuits;

    constructor() Claimable() public {}

    function registerCircuit(
        CircuitKey calldata key,
        uint[18]   calldata vk
        )
        external
        override
        nonReentrant
        onlyOwner
    {
        Circuit storage circuit = circuits[keyHash(key)];
        require(circuit.registered == false, "ALREADY_REGISTERED");

        for (uint i = 0; i < 18; i++) {
            circuit.verificationKey[i] = vk[i];
        }
        circuit.registered = true;
        circuit.enabled = true;

        emit CircuitRegistered(
            key.accountTreeDepth,
            key.blockType,
            key.rollupMode,
            key.blockSize,
            key.blockVersion
        );
    }

    function disableCircuit(
        CircuitKey calldata key
        )
        external
        override
        nonReentrant
        onlyOwner
    {
        Circuit storage circuit = circuits[keyHash(key)];
        require(circuit.registered == true, "NOT_REGISTERED");
        require(circuit.enabled == true, "ALREADY_DISABLED");

        circuit.enabled = false;

        emit CircuitDisabled(
            key.accountTreeDepth,
            key.blockType,
            key.rollupMode,
            key.blockSize,
            key.blockVersion
        );
    }

    function verifyProofs(
        CircuitKey calldata key,
        uint[]     calldata publicInputs,
        uint[]     calldata proofs
        )
        external
        override
        view
        returns (bool)
    {
        Circuit storage circuit = circuits[keyHash(key)];
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

    function isCircuitRegistered(CircuitKey calldata key)
        external
        override
        view
        returns (bool)
    {
        return circuits[keyHash(key)].registered;
    }

    function isCircuitEnabled(CircuitKey calldata key)
        external
        override
        view
        returns (bool)
    {
        return circuits[keyHash(key)].enabled;
    }

    function keyHash(CircuitKey calldata key)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(
            key.accountTreeDepth,
            key.blockType,
            key.rollupMode,
            key.blockSize,
            key.blockVersion
        ));
    }
}
