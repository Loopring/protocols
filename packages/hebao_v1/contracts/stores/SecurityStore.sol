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
        mapping    (address => uint) guardianEffectiveTime;
        mapping    (address => uint) guardianRemovalEffectiveTime;
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
            wallets[wallet].guardianEffectiveTime[guardian] >= now &&
            wallets[wallet].guardianRemovalEffectiveTime[guardian] < now;
    }

    function getGuardian(
        address wallet,
        address guardian
        )
        public
        view
        returns (Data.Guardian memory)
    {
        Wallet storage w = wallets[wallet];
        uint index = w.guardianIdx[guardian];
        require(index > 0, "NOT_A_GUARDIAN");
        require(
            w.guardianEffectiveTime[guardian] >= now &&
            w.guardianRemovalEffectiveTime[guardian] < now,
            "NOT_A_EFFECTIVE_GUARDIAN"
        );
        return wallets[wallet].guardians[index-1];
    }

    function guardians(address wallet)
        public
        view
        returns (Data.Guardian[] memory effectiveGuardians)
    {
        Wallet storage w = wallets[wallet];
        effectiveGuardians = new Data.Guardian[](w.guardians.length);
        uint index = 0;
        for (uint i = 0; i < w.guardians.length; i++) {
            Data.Guardian memory g = w.guardians[i];
            if (w.guardianEffectiveTime[g.addr] >= now &&
                w.guardianRemovalEffectiveTime[g.addr] < now) {
                effectiveGuardians[index] = g;
                index ++;
            }
        }
    }

    function numGuardians(address wallet)
        public
        view
        returns (uint)
    {
        Wallet storage w = wallets[wallet];
        uint num = 0;
        for (uint i = 0; i < w.guardians.length; i++) {
            Data.Guardian memory g = w.guardians[i];
            if (w.guardianEffectiveTime[g.addr] >= now &&
                w.guardianRemovalEffectiveTime[g.addr] < now) {
                num ++;
            }
        }
        return num;
    }

    function addOrUpdateGuardian(
        address wallet,
        address guardian,
        uint    group,
        uint    effectiveTime
        )
        public
        onlyManager
    {
        require(guardian != address(0), "ZERO_ADDRESS");
        Wallet storage w = wallets[wallet];

        uint pos = w.guardianIdx[guardian];
        if (pos == 0) {
            // Add the new guardian
            Data.Guardian memory g = Data.Guardian(
                guardian,
                group
            );
            w.guardians.push(g);
            w.guardianIdx[guardian] = w.guardians.length;
            w.guardianEffectiveTime[guardian] = effectiveTime;
        } else {
            // you're not be able to add a pending removal guardian,
            // use cancelGuardianRemoval instead.
            require(
                 w.guardianRemovalEffectiveTime[guardian] == 0 ||
                 w.guardianRemovalEffectiveTime[guardian] >= now,
                 "PENDING_REMOVAL_GUARDIAN"
            );

            // Update the guardian
            w.guardians[pos-1].group = group;
            w.guardianEffectiveTime[guardian] = effectiveTime;
            delete w.guardianRemovalEffectiveTime[guardian];
        }
    }

    function cancelGuardianAddition(
        address wallet,
        address guardian
        )
        public
        onlyManager
    {
        Wallet storage w = wallets[wallet];
        uint idx = w.guardianIdx[guardian];
        require(idx > 0, "GUARDIAN_NOT_EXISTS");
        require(
            w.guardianEffectiveTime[guardian] > 0 &&
            w.guardianEffectiveTime[guardian] < now,
            "NOT_PENDING_ADDITION"
        );

        Data.Guardian memory lastGuardian = w.guardians[w.guardians.length - 1];

        if (guardian != lastGuardian.addr) {
            w.guardians[idx - 1] = lastGuardian;
            w.guardianIdx[lastGuardian.addr] = idx;
        }
        w.guardians.pop();
        delete w.guardianIdx[guardian];
        delete w.guardianRemovalEffectiveTime[guardian];
    }

    function removeGuardian(
        address wallet,
        address guardian,
        uint    removalEffectiveTime
        )
        public
        onlyManager
    {
        Wallet storage w = wallets[wallet];
        uint idx = w.guardianIdx[guardian];
        require(idx > 0, "GUARDIAN_NOT_EXISTS");

        w.guardianRemovalEffectiveTime[guardian] = removalEffectiveTime;

        cleanRemovedGuardians(wallet);
    }

    function cancelGuardianRemoval(
        address wallet,
        address guardian
        )
        public
        onlyManager
    {
        Wallet storage w = wallets[wallet];
        uint idx = w.guardianIdx[guardian];
        require(idx > 0, "GUARDIAN_NOT_EXISTS");

        require(
            w.guardianRemovalEffectiveTime[guardian] > 0 &&
            w.guardianRemovalEffectiveTime[guardian] < now,
            "NOT_PENDING_REMOVAL"
         );

        delete w.guardianRemovalEffectiveTime[guardian];
    }

    function cleanRemovedGuardians(address wallet)
        public
        onlyManager
    {
        Wallet storage w = wallets[wallet];

        for (uint i = 0; i < w.guardians.length; i ++) {
            if (i >= w.guardians.length) {
                break;
            }
            Data.Guardian memory guardian = w.guardians[i];
            Data.Guardian memory lastGuardian = w.guardians[w.guardians.length - 1];

            if (guardian.addr != lastGuardian.addr) {
                w.guardians[i] = lastGuardian;
                w.guardianIdx[lastGuardian.addr] = i + 1;
            }
            w.guardians.pop();
            delete w.guardianIdx[guardian.addr];
            delete w.guardianRemovalEffectiveTime[guardian.addr];
        }

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

}
