// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../../../iface/IWallet.sol";
import "../../../stores/SecurityStore.sol";


/// @title GuardianUtils
/// @author Brecht Devos - <brecht@loopring.org>
library GuardianUtils
{
    enum SigRequirement
    {
        MAJORITY_OWNER_NOT_ALLOWED,
        MAJORITY_OWNER_ALLOWED,
        MAJORITY_OWNER_REQUIRED,
        OWNER_OR_ANY_GUARDIAN,
        ANY_GUARDIAN
    }

    function requireMajority(
        SecurityStore   securityStore,
        address         wallet,
        address[]       memory signers,
        SigRequirement  requirement
        )
        internal
        view
        returns (bool)
    {
        // We always need at least one signer
        if (signers.length == 0) {
            return false;
        }

        // Calculate total group sizes
        Data.Guardian[] memory allGuardians = securityStore.guardians(wallet, false);
        require(allGuardians.length > 0, "NO_GUARDIANS");

        address lastSigner;
        bool walletOwnerSigned = false;
        address owner = IWallet(wallet).owner();
        for (uint i = 0; i < signers.length; i++) {
            // Check for duplicates
            require(signers[i] > lastSigner, "INVALID_SIGNERS_ORDER");
            lastSigner = signers[i];

            if (signers[i] == owner) {
                walletOwnerSigned = true;
            } else {
                require(_isWalletGuardian(allGuardians, signers[i]), "SIGNER_NOT_GUARDIAN");
            }
        }

        if (requirement == SigRequirement.OWNER_OR_ANY_GUARDIAN) {
            return signers.length == 1;
        } else if (requirement == SigRequirement.ANY_GUARDIAN) {
            require(!walletOwnerSigned, "WALLET_OWNER_SIGNATURE_NOT_ALLOWED");
            return signers.length == 1;
        }

        // Check owner requirements
        if (requirement == SigRequirement.MAJORITY_OWNER_REQUIRED) {
            require(walletOwnerSigned, "WALLET_OWNER_SIGNATURE_REQUIRED");
        } else if (requirement == SigRequirement.MAJORITY_OWNER_NOT_ALLOWED) {
            require(!walletOwnerSigned, "WALLET_OWNER_SIGNATURE_NOT_ALLOWED");
        }

        uint numExtendedSigners = allGuardians.length;
        if (walletOwnerSigned) {
            numExtendedSigners += 1;
            require(signers.length > 1, "NO_GUARDIAN_SIGNED_BESIDES_OWNER");
        }

        return _hasMajority(signers.length, numExtendedSigners);
    }

    function _isWalletGuardian(
        Data.Guardian[] memory allGuardians,
        address signer
        )
        private
        pure
        returns (bool)
    {
        for (uint i = 0; i < allGuardians.length; i++) {
            if (allGuardians[i].addr == signer) {
                return true;
            }
        }
        return false;
    }

    function _hasMajority(
        uint signed,
        uint total
        )
        private
        pure
        returns (bool)
    {
        return total > 0 && signed >= (total >> 1) + 1;
    }
}
