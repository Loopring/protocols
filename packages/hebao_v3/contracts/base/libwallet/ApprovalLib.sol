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

    function verifyApproval(
        Wallet storage wallet,
        bytes32 domainSeparator,
        SigRequirement sigRequirement,
        Approval memory approval,
        bytes memory encodedRequest
    ) internal returns (bytes32 approvedHash) {
        require(address(this) == approval.wallet, "INVALID_WALLET");
        require(
            block.timestamp <= approval.validUntil,
            "EXPIRED_SIGNED_REQUEST"
        );

        approvedHash = EIP712.hashPacked(
            domainSeparator,
            keccak256(encodedRequest)
        );

        // Save hash to prevent replay attacks
        require(!wallet.hashes[approvedHash], "HASH_EXIST");
        wallet.hashes[approvedHash] = true;

        require(
            approvedHash.verifySignatures(
                approval.signers,
                approval.signatures
            ),
            "INVALID_SIGNATURES"
        );

        require(
            GuardianLib.requireMajority(
                wallet,
                approval.signers,
                sigRequirement
            ),
            "PERMISSION_DENIED"
        );
    }
}
