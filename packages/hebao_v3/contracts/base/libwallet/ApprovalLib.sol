// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;
pragma experimental ABIEncoderV2;

import "../../lib/EIP712.sol";
import "../../lib/SignatureUtil.sol";
import "./GuardianLib.sol";
import "./WalletData.sol";
import "../../account-abstraction/core/Helpers.sol";

/// @title ApprovalLib
/// @dev Utility library for better handling of signed wallet requests.
///      This library must be deployed and linked to other modules.
///
/// @author Daniel Wang - <daniel@loopring.org>
library ApprovalLib {
    using SignatureUtil for bytes32;
    uint256 constant SIG_VALIDATION_FAILED = 1;

    function verifyApproval(
        Wallet storage wallet,
        bytes32 approvedHash,
        SigRequirement sigRequirement,
        Approval memory approval
    ) internal returns (uint256) {
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
                _packValidationData(
                    false,
                    approval.validUntil,
                    uint48(0) /*valid immediately*/
                );
        }
        return SIG_VALIDATION_FAILED;
    }
}
