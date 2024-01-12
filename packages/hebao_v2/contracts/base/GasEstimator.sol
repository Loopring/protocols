// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

interface WalletInterface {
    function executeMetaTx(
        address to,
        uint nonce,
        address gasToken,
        uint gasPrice,
        uint gasLimit,
        uint gasOverhead,
        address feeRecipient,
        bool requiresSuccess,
        bytes calldata data,
        bytes memory signature
    ) external returns (bool);
}

contract GasEstimator {
    bytes32 constant ERROR_STRING_HASH = keccak256("METATX_INVALID_SIGNATURE");
    uint256 constant GAS_OVERHEAD = 50000;

    function estimateGas(
        WalletInterface wallet,
        address to,
        uint nonce,
        address gasToken,
        uint gasPrice,
        uint gasLimit,
        uint gasOverhead,
        address feeRecipient,
        bool requiresSuccess,
        bytes calldata data,
        bytes memory signature
    ) external returns (uint256 estimatedGas) {
        uint gasLeft = gasleft();
        try
            wallet.executeMetaTx(
                to,
                nonce,
                gasToken,
                gasPrice,
                gasLimit,
                gasOverhead,
                feeRecipient,
                requiresSuccess,
                data,
                signature
            )
        {} catch (bytes memory reason) {
            estimatedGas = gasLeft - gasleft();
            assembly {
                reason := add(reason, 0x04)
            }
            string memory reason_str = abi.decode(reason, (string));
            require(
                ERROR_STRING_HASH == keccak256(bytes(reason_str)),
                "GAS ESTIMATION ERROR"
            );
        }

        // add gas overhead
        estimatedGas += GAS_OVERHEAD;
    }
}
