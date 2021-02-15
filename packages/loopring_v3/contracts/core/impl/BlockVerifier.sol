// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../../lib/ReentrancyGuard.sol";
import "../../thirdparty/verifiers/BatchVerifier.sol";
import "../../thirdparty/verifiers/Verifier.sol";
import "../iface/ExchangeData.sol";
import "../iface/IBlockVerifier.sol";
import "./VerificationKeys.sol";


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

    mapping (uint8 => mapping (uint16 => mapping (uint8 => Circuit))) public circuits;

    constructor() Claimable() {}

    function registerCircuit(
        uint8    blockType,
        uint16   blockSize,
        uint8    blockVersion,
        uint[18] calldata vk
        )
        external
        override
        nonReentrant
        onlyOwner
    {
        Circuit storage circuit = circuits[blockType][blockSize][blockVersion];
        require(circuit.registered == false, "ALREADY_REGISTERED");

        // Store the verification key on-chain.
        for (uint i = 0; i < 18; i++) {
            circuit.verificationKey[i] = vk[i];
        }
        circuit.registered = true;
        circuit.enabled = true;

        emit CircuitRegistered(
            blockType,
            blockSize,
            blockVersion
        );
    }

    function disableCircuit(
        uint8  blockType,
        uint16 blockSize,
        uint8  blockVersion
        )
        external
        override
        nonReentrant
        onlyOwner
    {
        Circuit storage circuit = circuits[blockType][blockSize][blockVersion];
        require(circuit.registered == true, "NOT_REGISTERED");
        require(circuit.enabled == true, "ALREADY_DISABLED");

        // Disable the circuit
        circuit.enabled = false;

        emit CircuitDisabled(
            blockType,
            blockSize,
            blockVersion
        );
    }

    function verifyProofs(
        uint8  blockType,
        uint16 blockSize,
        uint8  blockVersion,
        uint[] calldata publicInputs,
        uint[] calldata proofs
        )
        external
        override
        view
        returns (bool)
    {
        // First try to find the verification key in the hard coded list
        (uint[14] memory _vk, uint[4] memory _vk_gammaABC, bool found) = VerificationKeys.getKey(
            blockType,
            blockSize,
            blockVersion
        );
        if (!found) {
            Circuit storage circuit = circuits[blockType][blockSize][blockVersion];
            require(circuit.registered == true, "NOT_REGISTERED");
            require(circuit.enabled == true, "NOT_ENABLED");

            // Load the verification key from storage.
            uint[18] storage vk = circuit.verificationKey;
            _vk = [
                vk[0], vk[1], vk[2], vk[3], vk[4], vk[5], vk[6],
                vk[7], vk[8], vk[9], vk[10], vk[11], vk[12], vk[13]
            ];
            _vk_gammaABC = [vk[14], vk[15], vk[16], vk[17]];
        }

        // Verify the proof.
        // Batched proof verification has a fixed overhead which makes it more
        // expensive to verify a single proof compared to the non-batched code
        // This is why we don't use the batched verification code here when only
        // a single proof needs to be verified.
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
        uint16 blockSize,
        uint8  blockVersion
        )
        external
        override
        view
        returns (bool)
    {
        return circuits[blockType][blockSize][blockVersion].registered;
    }

    function isCircuitEnabled(
        uint8  blockType,
        uint16 blockSize,
        uint8  blockVersion
        )
        external
        override
        view
        returns (bool)
    {
        return circuits[blockType][blockSize][blockVersion].enabled;
    }

    function getVerificationKey(
        uint8  blockType,
        uint16 blockSize,
        uint8  blockVersion
        )
        public
        view
        returns (uint[18] memory)
    {
        return circuits[blockType][blockSize][blockVersion].verificationKey;
    }
}
