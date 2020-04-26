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
pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "../base/DataStore.sol";
import "../iface/Data.sol";


/// @title SecurityStore
///
/// @author Daniel Wang - <daniel@loopring.org>
///
/// The design of this contract is inspired by Argent's contract codebase:
/// https://github.com/argentlabs/argent-contracts
contract SecurityStore is DataStore
{
    struct Wallet
    {
        address    inheritor;
        uint128    lastActive; // the latest timestamp the owner is considered to be active
        uint128    lock;
        address    lockedBy;   // the module that locked the wallet.

        Data.Guardian[] guardians;

        mapping    (address => uint) guardianIdx;
        mapping    (address => uint) guardianValidSince;
        mapping    (address => uint) guardianValidUntil;
    }

    mapping (address => Wallet) public wallets;

    constructor() public DataStore() {}

    function isGuardian(
        address wallet,
        address guardian
        )
        public
        view
        returns (bool)
    {
        return wallets[wallet].guardianIdx[guardian] > 0 &&
            isGuardianValid(wallet, guardian);
    }

    function getGuardianValidTs(
        address wallet,
        address guardian
        )
        public
        view
        returns (uint, uint)
    {
        return (wallets[wallet].guardianValidSince[guardian],
                wallets[wallet].guardianValidUntil[guardian]);
    }


    function getGuardian(
        address wallet,
        address guardian
        )
        public
        view
        returns (Data.Guardian memory)
    {
        uint index = wallets[wallet].guardianIdx[guardian];
        return wallets[wallet].guardians[index-1];
    }

    function guardians(address wallet)
        public
        view
        returns (Data.Guardian[] memory validGuardians)
    {
        Wallet storage w = wallets[wallet];
        validGuardians = new Data.Guardian[](w.guardians.length);
        uint index = 0;
        for (uint i = 0; i < w.guardians.length; i++) {
            Data.Guardian memory g = w.guardians[i];
            if (isGuardianValid(wallet, g.addr)) {
                validGuardians[index] = g;
                index ++;
            }
        }
        assembly { mstore(validGuardians, index) }
    }

    function numGuardians(address wallet)
        public
        view
        returns (uint)
    {
        return guardians(wallet).length;
    }

    function numGuardiansWithPending(address wallet)
        public
        view
        returns (uint)
    {
        Wallet storage w = wallets[wallet];
        uint num = 0;
        for (uint i = 0; i < w.guardians.length; i++) {
            Data.Guardian memory g = w.guardians[i];
            if (w.guardianValidSince[g.addr] > 0 &&
                w.guardianValidUntil[g.addr] < now) {
                num ++;
            }
        }
        return num;
    }

    function addGuardian(
        address wallet,
        address guardian,
        uint    group,
        uint    validSince
        )
        public
        onlyManager
    {
        cleanRemovedGuardians(wallet);

        require(guardian != address(0), "ZERO_ADDRESS");
        Wallet storage w = wallets[wallet];

        uint pos = w.guardianIdx[guardian];
        require(pos == 0, "GUARDIAN_EXISTS");

        // Add the new guardian
        Data.Guardian memory g = Data.Guardian(guardian, group);
        w.guardians.push(g);
        w.guardianIdx[guardian] = w.guardians.length;
        w.guardianValidSince[guardian] = validSince;
    }

    function cancelGuardianAddition(
        address wallet,
        address guardian
        )
        public
        onlyManager
    {
        cleanRemovedGuardians(wallet);

        Wallet storage w = wallets[wallet];
        uint idx = w.guardianIdx[guardian];
        require(idx > 0, "GUARDIAN_NOT_EXISTS");
        require(
            isGuardianPendingAddition(wallet, guardian),
            "NOT_PENDING_ADDITION"
        );

        Data.Guardian memory lastGuardian = w.guardians[w.guardians.length - 1];
        if (guardian != lastGuardian.addr) {
            w.guardians[idx - 1] = lastGuardian;
            w.guardianIdx[lastGuardian.addr] = idx;
        }
        w.guardians.pop();
        delete w.guardianIdx[guardian];
        delete w.guardianValidSince[guardian];
    }

    function removeGuardian(
        address wallet,
        address guardian,
        uint    validUntil
        )
        public
        onlyManager
    {
        cleanRemovedGuardians(wallet);

        Wallet storage w = wallets[wallet];
        uint idx = w.guardianIdx[guardian];
        require(idx > 0, "GUARDIAN_NOT_EXISTS");

        w.guardianValidUntil[guardian] = validUntil;
    }

    function cancelGuardianRemoval(
        address wallet,
        address guardian
        )
        public
        onlyManager
    {
        cleanRemovedGuardians(wallet);

        Wallet storage w = wallets[wallet];
        uint idx = w.guardianIdx[guardian];
        require(idx > 0, "GUARDIAN_NOT_EXISTS");

        require(
            isGuardianPendingRemoval(wallet, guardian),
            "NOT_PENDING_REMOVAL"
         );

        delete w.guardianValidUntil[guardian];
    }

    function getLock(address wallet)
        public
        view
        returns (uint _lock, address _module)
    {
        _lock = uint(wallets[wallet].lock);
        _module = wallets[wallet].lockedBy;
    }

    function setLock(
        address wallet,
        uint    lock
        )
        public
        onlyManager
    {
        require(lock == 0 || lock > now, "INVALID_LOCK_TIME");
        uint128 _lock = uint128(lock);
        require(uint(_lock) == lock, "LOCK_TOO_LARGE");

        wallets[wallet].lock = _lock;
        wallets[wallet].lockedBy = msg.sender;
    }

    function touchLastActive(address wallet)
        public
        onlyManager
    {
        wallets[wallet].lastActive = uint128(now);
    }

    function inheritor(address wallet)
        public
        view
        returns (
            address who,
            uint    lastActive
        )
    {
        who = wallets[wallet].inheritor;
        lastActive = uint(wallets[wallet].lastActive);
    }

    function setInheritor(address wallet, address who)
        public
        onlyManager
    {
        wallets[wallet].inheritor = who;
        wallets[wallet].lastActive = uint128(now);
    }

    function cleanRemovedGuardians(address wallet)
        private
    {
        Wallet storage w = wallets[wallet];

        for (uint i = 0; i < w.guardians.length; i ++) {
            Data.Guardian memory guardian = w.guardians[i];
            if (w.guardianValidUntil[guardian.addr] < now) {
                Data.Guardian memory lastGuardian = w.guardians[w.guardians.length - 1];

                if (guardian.addr != lastGuardian.addr) {
                    w.guardians[i] = lastGuardian;
                    w.guardianIdx[lastGuardian.addr] = i + 1;
                }
                w.guardians.pop();
                delete w.guardianIdx[guardian.addr];
                delete w.guardianValidSince[guardian.addr];
                delete w.guardianValidUntil[guardian.addr];
            }
        }
    }

    function isGuardianValid(address wallet, address guardian)
        view
        private
        returns (bool)
    {
        return wallets[wallet].guardianValidSince[guardian] > 0 &&
            wallets[wallet].guardianValidSince[guardian] <= now &&
            (wallets[wallet].guardianValidUntil[guardian] == 0 ||
             wallets[wallet].guardianValidUntil[guardian] >= now
             );
    }

    function isGuardianPendingAddition(address wallet, address guardian)
        view
        private
        returns (bool)
    {
        return wallets[wallet].guardianValidSince[guardian] > now;
    }

    function isGuardianPendingRemoval(address wallet, address guardian)
        view
        private
        returns (bool)
    {
        return wallets[wallet].guardianValidUntil[guardian] > now;
    }
}
