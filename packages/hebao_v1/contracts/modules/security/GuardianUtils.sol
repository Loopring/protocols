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

import "../../stores/SecurityStore.sol";
import "../../iface/Wallet.sol";


/// @title GuardianUtils
/// @author Brecht Devos - <brecht@loopring.org>
library GuardianUtils
{
    function MAX_NUM_GROUPS() internal pure returns (uint) { return 16; }

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
    {
        // Calculate total group sizes
        Data.Guardian[] memory allGuardians = securityStore.guardians(wallet);
        uint[16] memory total = countGuardians(allGuardians);

        // Calculate how many signers are in each group
        bool walletOwnerSigned = false;
        Data.Guardian[] memory signingGuardians = new Data.Guardian[](signers.length);
        address walletOwner = Wallet(wallet).owner();
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
        uint[16] memory signed = countGuardians(signingGuardians);

        // Check owner requirements
        if (requirement == SigRequirement.OwnerRequired) {
            require(walletOwnerSigned, "WALLET_OWNER_SIGNATURE_REQUIRED");
        } else if (requirement == SigRequirement.OwnerNotAllowed) {
            require(!walletOwnerSigned, "WALLET_OWNER_SIGNATURE_NOT_ALLOWED");
        }

        // Count the number of votes
        uint totalNumVotes = 0;
        uint numVotes = 0;
        if (requirement != SigRequirement.OwnerNotAllowed) {
            totalNumVotes += 1;
            numVotes += walletOwnerSigned ? 1 : 0;
        }
        // Group 0: No grouping
        if (total[0] > 0) {
            totalNumVotes += total[0];
            numVotes += signed[0];
        }
        // Groups [1, 5]: Single guardian needed per group
        for (uint i = 1; i < 5; i++) {
            if (total[i] > 0) {
                totalNumVotes += 1;
                numVotes += signed[i] > 0 ? 1 : 0;
            }
        }
        // Groups [6, 10]: Half the guardians needed per group
        for (uint i = 6; i < 10; i++) {
            if (total[i] > 0) {
                totalNumVotes += 1;
                numVotes += hasHalf(signed[i], total[i]) ? 1 : 0;
            }
        }
        // Groups [11, 15]: A majority of guardians needed per group
        for (uint i = 11; i < MAX_NUM_GROUPS(); i++) {
            if (total[i] > 0) {
                totalNumVotes += 1;
                numVotes += hasMajority(signed[i], total[i]) ? 1 : 0;
            }
        }

        // We need a majority of votes
        require(hasMajority(numVotes, totalNumVotes), "NOT_ENOUGH_SIGNERS");
    }

    function hasHalf(
        uint count,
        uint total
        )
        internal
        pure
        returns (bool)
    {
        return (count >= (total + 1) / 2);
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
        Data.Guardian[] memory guardians
        )
        internal
        pure
        returns (uint[16] memory total)
    {
        for (uint i = 0; i < guardians.length; i++) {
            total[guardians[i].group]++;
        }
    }
}

