/*

  Copyright 2017 Loopring Project Ltd (Loopring Foundation).

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/
pragma solidity ^0.5.13;

import "./SecurityModule.sol";


/// @title GuardianType
/// @author Brecht Devos - <brecht@loopring.org>
library GuardianType
{
    function None()            internal pure returns (uint) { return      0; }
    function SelfControlled()  internal pure returns (uint) { return 1 << 0; }
    function Family()          internal pure returns (uint) { return 1 << 1; }
    function Friend()          internal pure returns (uint) { return 1 << 2; }
    function Hardware()        internal pure returns (uint) { return 1 << 3; }
    function Device()          internal pure returns (uint) { return 1 << 4; }
    function Service()         internal pure returns (uint) { return 1 << 5; }
    function EOA()             internal pure returns (uint) { return 1 << 6; }
}

library GuardianUtils
{
    enum SigRequirement
    {
        OwnerNotAllowed,
        OwnerAllowed,
        OwnerRequired
    }

    function requireSufficientSigners(
        SecurityStore   securityStore,
        address         wallet,
        address[]       memory signers,
        SigRequirement  requirement
        )
        internal
        view
    {
        // Calculate total group sizes
        SecurityStore.Guardian[] memory allGuardians = securityStore.guardians(wallet);
        (
            uint totalNumSelfControlled,
            uint totalNumFriends,
            uint totalNumFamily,
            uint totalNumSocialOther
        ) = countGuardians(allGuardians);

        // Calculate how many signers are in each group
        address walletOwner = Wallet(wallet).owner();
        bool walletOwnerSigned = false;
        SecurityStore.Guardian[] memory signingGuardians = new SecurityStore.Guardian[](signers.length);
        uint numGuardians = 0;
        for (uint i = 0; i < signers.length; i++) {
            if (signers[i] == walletOwner) {
                walletOwnerSigned = true;
            } else {
                signingGuardians[numGuardians++] = securityStore.getGuardian(wallet, signers[i]);
            }
        }
        // Update the signingGuardians array with the actual number of guardians that have signed
        // (could be 1 less than the length if the owner signed as well)
        assembly { mstore(signingGuardians, numGuardians) }
        (
            uint numSelfControlled,
            uint numFriends,
            uint numFamily,
            uint numSocialOther
        ) = countGuardians(signingGuardians);
        // Count the wallet owner as a self controlled guardian
        if (walletOwnerSigned) {
            numSelfControlled += 1;
        }

        // Check owner requirements
        if (requirement == SigRequirement.OwnerRequired) {
            require(walletOwnerSigned, "WALLET_OWNER_SIGNATURE_REQUIRED");
        } else if (requirement == SigRequirement.OwnerNotAllowed) {
            require(!walletOwnerSigned, "WALLET_OWNER_SIGNATURE_NOT_ALLOWED");
        }

        // If no social guardians are used do self authentication
        if (numFriends + numFamily + numSocialOther == 0) {
            /* Self authentication */
            uint numSelfControlledRequired = 2;
            // If the owner is allowed to sign:
            // - increase the total number of self controlled guardians
            // - increase the number of required self controlled guardians
            if (requirement != SigRequirement.OwnerNotAllowed) {
                totalNumSelfControlled += 1;
                numSelfControlledRequired += 1;
            }
            // - Either the number of required signers is reached
            // - or the required number of signers is lower than the total number of self
            //   controlled guardians, in which case all self controlled guardians need to sign
            //   (which may include the wallet owner if he is allowed to sign).
            require(
                numSelfControlled >= numSelfControlledRequired ||
                numSelfControlled == totalNumSelfControlled && totalNumSelfControlled > 0,
                "NOT_ENOUGH_SIGNERS"
            );
        } else {
            /* Social authentication */
            uint numGroups = 0;
            uint numGroupsWithMajority = 0;
            // Count the number of active groups and see which ones have a majority of signers
            if (totalNumFriends > 0) {
                numGroups++;
                numGroupsWithMajority += hasMajority(numFriends, totalNumFriends) ? 1 : 0;
            }
            if (totalNumFamily > 0) {
                numGroups++;
                numGroupsWithMajority += hasMajority(numFamily, totalNumFamily) ? 1 : 0;
            }
            if (totalNumSocialOther > 0) {
                numGroups++;
                numGroupsWithMajority += hasMajority(numSocialOther, totalNumSocialOther) ? 1 : 0;
            }
            // Require a majority of groups to have a majority of signing guardians
            require(hasMajority(numGroupsWithMajority, numGroups), "NOT_ENOUGH_SIGNERS");
        }
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

    function countGuardians(
        SecurityStore.Guardian[] memory guardians
        )
        internal
        pure
        returns (
            uint numSelfControlled,
            uint numFriends,
            uint numFamily,
            uint numSocialOther
        )
    {
        for (uint i = 0; i < guardians.length; i++) {
            if (guardians[i].types & GuardianType.SelfControlled() != 0) {
                numSelfControlled++;
            } else {
                if (guardians[i].types & GuardianType.Friend() != 0) {
                    numFriends++;
                } else if (guardians[i].types & GuardianType.Family() != 0) {
                    numFamily++;
                } else {
                    numSocialOther++;
                }
            }
        }
    }
}

