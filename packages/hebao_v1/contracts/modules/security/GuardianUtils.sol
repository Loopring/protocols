// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../../stores/SecurityStore.sol";
import "../../iface/Wallet.sol";


/// @title GuardianUtils
/// @author Brecht Devos - <brecht@loopring.org>
library GuardianUtils
{
    enum SigRequirement
    {
        OwnerNotAllowed,
        OwnerAllowed,
        OwnerRequired
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
        Data.Guardian[] memory allGuardians = securityStore.guardians(wallet);

        bool walletOwnerSigned = false;
        address walletOwner = Wallet(wallet).owner();

        uint numSigners = allGuardians.length;
        uint numGuardianApprovals = signers.length;

        address lastSigner;
        for (uint i = 0; i < signers.length; i++) {
            // Check for duplicates
            require(signers[i] > lastSigner, "INVALID_SIGNERS_ORDER");
            lastSigner = signers[i];

            if (signers[i] == walletOwner) {
                walletOwnerSigned = true;
            } else {
                require(isWalletGuardian(allGuardians, signers[i]), "SIGNER_NOT_GUARDIAN");
            }
        }

        if (walletOwnerSigned) {
            numSigners += 1;
            numGuardianApprovals -= 1;
        }

        // Check owner requirements
        if (requirement == SigRequirement.OwnerRequired) {
            require(walletOwnerSigned, "WALLET_OWNER_SIGNATURE_REQUIRED");
        } else if (requirement == SigRequirement.OwnerNotAllowed) {
            require(!walletOwnerSigned, "WALLET_OWNER_SIGNATURE_NOT_ALLOWED");
        }

        return hasMajority(numGuardianApprovals, numSigners);
    }

    function isWalletGuardian(
        Data.Guardian[] memory allGuardians,
        address signer
        )
        internal
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

    function hasMajority(
        uint numGuardianApprovals,
        uint numSigners
        )
        internal
        pure
        returns (bool)
    {
        return numSigners > 0 && numGuardianApprovals >= (numSigners >> 1) + 1;
    }
}
