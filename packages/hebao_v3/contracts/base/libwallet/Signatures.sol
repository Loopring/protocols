// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.17;

import "../../iface/UserOperation.sol";
import {SigRequirement} from "./WalletData.sol";

/**
 * @dev Signatures layout used by the Paymasters and Wallets internally
 * @param mode whether it is an owner's or a guardian's signature
 * @param values list of signatures value to validate
 */
struct SignatureData {
    SigRequirement mode;
    address[] signers;
    uint64 deadline;
    bytes[] signatures;
}

/**
 * @dev Signature mode to denote whether it is an owner's or a guardian's signature
 */

library Signatures {
    /**
     * @dev Decodes a user operation's signature assuming the expected layout defined by the Signatures library
     */
    function decodeSignature(
        UserOperation calldata op
    ) internal pure returns (SignatureData memory) {
        return decodeSignature(op.signature);
    }

    /**
     * @dev Decodes a signature assuming the expected layout defined by the Signatures library
     */
    function decodeSignature(
        bytes memory signature
    ) internal pure returns (SignatureData memory) {
        (
            SigRequirement _mode,
            address[] memory _signers,
            uint64 _deadline,
            bytes[] memory _signatures
        ) = abi.decode(signature, (SigRequirement, address[], uint64, bytes[]));
        return SignatureData(_mode, _signers, _deadline, _signatures);
    }
}
