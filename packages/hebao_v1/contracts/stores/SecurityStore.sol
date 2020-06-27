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
pragma solidity ^0.6.6;
pragma experimental ABIEncoderV2;

import "../base/DataStore.sol";
import "../stores/Data.sol";


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

        Data.Guardian[]            guardians;
        mapping (address => uint)  guardianIdx;
    }

    mapping (address => Wallet) public wallets;

    constructor() public DataStore() {}

    function isGuardian(
        address wallet,
        address addr
        )
        public
        view
        returns (bool)
    {
        Data.Guardian memory guardian = getGuardian(wallet, addr);
        return guardian.addr != address(0) && isGuardianActive(guardian);
    }

    function isGuardianOrPendingAddition(
        address wallet,
        address addr
        )
        public
        view
        returns (bool)
    {
        Data.Guardian memory guardian = getGuardian(wallet, addr);
        return guardian.addr != address(0) && (isGuardianActive(guardian) || isGuardianPendingAddition(guardian));
    }

    function getGuardian(
        address wallet,
        address guardianAddr
        )
        public
        view
        returns (Data.Guardian memory)
    {
        uint index = wallets[wallet].guardianIdx[guardianAddr];
        if (index > 0) {
            return wallets[wallet].guardians[index-1];
        }
    }

    // @dev Returns active guardians.
    function guardians(address wallet)
        public
        view
        returns (Data.Guardian[] memory _guardians)
    {
        Wallet storage w = wallets[wallet];
        _guardians = new Data.Guardian[](w.guardians.length);
        uint index = 0;
        for (uint i = 0; i < w.guardians.length; i++) {
            Data.Guardian memory g = w.guardians[i];
            if (isGuardianActive(g)) {
                _guardians[index] = g;
                index ++;
            }
        }
        assembly { mstore(_guardians, index) }
    }

    // @dev Returns the number of active guardians.
    function numGuardians(address wallet)
        public
        view
        returns (uint count)
    {
        Wallet storage w = wallets[wallet];
        for (uint i = 0; i < w.guardians.length; i++) {
            if (isGuardianActive(w.guardians[i])) {
                count ++;
            }
        }
    }

    // @dev Returns guardians who are either active or pending addition.
    function guardiansWithPending(address wallet)
        public
        view
        returns (Data.Guardian[] memory _guardians)
    {
        Wallet storage w = wallets[wallet];
        _guardians = new Data.Guardian[](w.guardians.length);
        uint index = 0;
        for (uint i = 0; i < w.guardians.length; i++) {
            Data.Guardian memory g = w.guardians[i];
            if (isGuardianActive(g) || isGuardianPendingAddition(g)) {
                _guardians[index] = g;
                index ++;
            }
        }
        assembly { mstore(_guardians, index) }
    }

    // @dev Returns the number of guardians who are active or pending addition.
    function numGuardiansWithPending(address wallet)
        public
        view
        returns (uint count)
    {
        Wallet storage w = wallets[wallet];
        for (uint i = 0; i < w.guardians.length; i++) {
            Data.Guardian memory g = w.guardians[i];
            if (isGuardianActive(g) || isGuardianPendingAddition(g)) {
                count ++;
            }
        }
    }

    function addGuardian(
        address wallet,
        address guardianAddr,
        uint    group,
        uint    validSince
        )
        public
        onlyWalletModule(wallet)
    {
        cleanRemovedGuardians(wallet);

        require(guardianAddr != address(0), "ZERO_ADDRESS");
        Wallet storage w = wallets[wallet];

        uint pos = w.guardianIdx[guardianAddr];
        require(pos == 0, "GUARDIAN_EXISTS");

        // Add the new guardian
        Data.Guardian memory g = Data.Guardian(guardianAddr, group, validSince, 0);
        w.guardians.push(g);
        w.guardianIdx[guardianAddr] = w.guardians.length;
    }

    function cancelGuardianAddition(
        address wallet,
        address guardianAddr
        )
        public
        onlyWalletModule(wallet)
    {
        cleanRemovedGuardians(wallet);

        Wallet storage w = wallets[wallet];
        uint idx = w.guardianIdx[guardianAddr];
        require(idx > 0, "GUARDIAN_NOT_EXISTS");
        require(
            isGuardianPendingAddition(w.guardians[idx - 1]),
            "NOT_PENDING_ADDITION"
        );

        Data.Guardian memory lastGuardian = w.guardians[w.guardians.length - 1];
        if (guardianAddr != lastGuardian.addr) {
            w.guardians[idx - 1] = lastGuardian;
            w.guardianIdx[lastGuardian.addr] = idx;
        }
        w.guardians.pop();
        delete w.guardianIdx[guardianAddr];
    }

    function removeGuardian(
        address wallet,
        address guardianAddr,
        uint    validUntil
        )
        public
        onlyWalletModule(wallet)
    {
        cleanRemovedGuardians(wallet);

        Wallet storage w = wallets[wallet];
        uint idx = w.guardianIdx[guardianAddr];
        require(idx > 0, "GUARDIAN_NOT_EXISTS");

        w.guardians[idx - 1].validUntil = validUntil;
    }

    function removeAllGuardians(address wallet)
        public
        onlyWalletModule(wallet)
    {
         Wallet storage w = wallets[wallet];
         for (uint i = 0; i < w.guardians.length; i++) {
            delete w.guardianIdx[w.guardians[i].addr];
         }
         delete w.guardians;
    }

    function cancelGuardianRemoval(
        address wallet,
        address guardianAddr
        )
        public
        onlyWalletModule(wallet)
    {
        cleanRemovedGuardians(wallet);

        Wallet storage w = wallets[wallet];
        uint idx = w.guardianIdx[guardianAddr];
        require(idx > 0, "GUARDIAN_NOT_EXISTS");

        require(
            isGuardianPendingRemoval(w.guardians[idx - 1]),
            "NOT_PENDING_REMOVAL"
         );

        w.guardians[idx - 1].validUntil = 0;
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
        onlyWalletModule(wallet)
    {
        require(lock == 0 || lock > now, "INVALID_LOCK_TIME");
        uint128 _lock = uint128(lock);
        require(uint(_lock) == lock, "LOCK_TOO_LARGE");

        wallets[wallet].lock = _lock;
        wallets[wallet].lockedBy = msg.sender;
    }

    function touchLastActive(address wallet)
        public
        onlyWalletModule(wallet)
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
        onlyWalletModule(wallet)
    {
        wallets[wallet].inheritor = who;
        wallets[wallet].lastActive = uint128(now);
    }

    function cleanRemovedGuardians(address wallet)
        private
    {
        Wallet storage w = wallets[wallet];

        for (int i = int(w.guardians.length) - 1; i >= 0; i--) {
            Data.Guardian memory g = w.guardians[uint(i)];
            if (isGuardianExpired(g)) {
                Data.Guardian memory lastGuardian = w.guardians[w.guardians.length - 1];

                if (g.addr != lastGuardian.addr) {
                    w.guardians[uint(i)] = lastGuardian;
                    w.guardianIdx[lastGuardian.addr] = uint(i) + 1;
                }
                w.guardians.pop();
                delete w.guardianIdx[g.addr];
            }
        }
    }

    function isGuardianActive(Data.Guardian memory guardian)
        private
        view
        returns (bool)
    {
        return guardian.validSince > 0 && guardian.validSince <= now &&
            !isGuardianExpired(guardian);
    }

    function isGuardianPendingAddition(Data.Guardian memory guardian)
        private
        view
        returns (bool)
    {
        return guardian.validSince > now;
    }

    function isGuardianPendingRemoval(Data.Guardian memory guardian)
        private
        view
        returns (bool)
    {
        return guardian.validUntil > now;
    }

    function isGuardianExpired(Data.Guardian memory guardian)
        private
        view
        returns (bool)
    {
        return guardian.validUntil > 0 &&
            guardian.validUntil <= now;
    }

}