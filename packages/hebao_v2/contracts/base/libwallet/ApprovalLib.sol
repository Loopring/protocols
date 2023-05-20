// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;
pragma experimental ABIEncoderV2;

import "../../lib/EIP712.sol";
import "../../lib/SignatureUtil.sol";
import "./GuardianLib.sol";
import "./WalletData.sol";

/// @title ApprovalLib
/// @dev Utility library for better handling of signed wallet requests.
///      This library must be deployed and linked to other modules.
///
/// @author Daniel Wang - <daniel@loopring.org>
library ApprovalLib {
    using SignatureUtil for bytes32;
    uint256 constant SIG_VALIDATION_FAILED = 1;

    function packSignatureHash(
        bytes32 hash,
        Approval memory approval
    ) internal pure returns (bytes32) {
        bytes32 _hash = keccak256(abi.encodePacked(hash, approval.validUntil));
        return _hash;
    }

    /**
     * helper to pack the return value for validateUserOp
     * @param sigFailed true if the signature check failed, false, if it succeeded.
     * @param validUntil last timestamp this UserOperation is valid (or zero for infinite)
     * @param validAfter first timestamp this UserOperation is valid
     */
    function packSigTimeRange(
        bool sigFailed,
        uint256 validUntil,
        uint256 validAfter
    ) internal pure returns (uint256) {
        return
            uint256(sigFailed ? 1 : 0) |
            uint256(validUntil << 8) |
            uint256(validAfter << (64 + 8));
    }

    function verifyApproval(
        Wallet storage wallet,
        SigRequirement sigRequirement,
        bytes32 userOpHash,
        bytes memory signature
    ) internal returns (uint256) {
        Approval memory approval = abi.decode(signature, (Approval));
        // bytes32 approvedHash = userOpHash;
        bytes32 approvedHash = packSignatureHash(userOpHash, approval);
        // Save hash to prevent replay attacks
        require(!wallet.hashes[approvedHash], "HASH_EXIST");
        wallet.hashes[approvedHash] = true;

        if (
            approvedHash.verifySignatures(
                approval.signers,
                approval.signatures
            ) &&
            GuardianLib.requireMajority(
                wallet,
                approval.signers,
                sigRequirement
            )
        ) {
            return
                packSigTimeRange(
                    false,
                    approval.validUntil,
                    0 /*valid immediately*/
                );
        }
        return SIG_VALIDATION_FAILED;
    }
}
