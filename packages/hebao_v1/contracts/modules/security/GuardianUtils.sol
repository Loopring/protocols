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
        uint totalNumVotes = allGuardians.length;

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
            totalNumVotes += 1;
            // We always need at least one guardian signer
            require(signers.length > 1, "NO_GUARDIAN_SIGNER");
        }

        // Check owner requirements
        if (requirement == SigRequirement.OwnerRequired) {
            require(walletOwnerSigned, "WALLET_OWNER_SIGNATURE_REQUIRED");
        } else if (requirement == SigRequirement.OwnerNotAllowed) {
            require(!walletOwnerSigned, "WALLET_OWNER_SIGNATURE_NOT_ALLOWED");
        }

        // We need a majority of votes
        require(hasMajority(signers.length, totalNumVotes), "NOT_ENOUGH_SIGNERS");

        return true;
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
        uint count,
        uint total
        )
        internal
        pure
        returns (bool)
    {
        return (count >= (total / 2) + 1);
    }

}
