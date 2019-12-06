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
pragma solidity ^0.5.11;
pragma experimental ABIEncoderV2;

import "../base/DataStore.sol";


/// @title SecurityStore
///
/// @author Daniel Wang - <daniel@loopring.org>
///
/// The design of this contract is inspired by Argent's contract codebase:
/// https://github.com/argentlabs/argent-contracts
contract SecurityStore is DataStore
{
    struct Guardian
    {
        address addr;
        uint    info;
    }

    struct Wallet
    {
        address    inheritor;
        uint128    lastActive; // the latest timestamp the owner is considered to be active
        uint128    lock;
        address    locker; // the module locked/unlocked this wallet
        Guardian[] guardians;
        mapping    (address => uint) guardianIdx;
    }

    mapping (address => Wallet) public wallets;

    constructor() public DataStore() {}

    function isGuardian(address wallet, address guardian)
        public
        view
        returns (bool)
    {
        return wallets[wallet].guardianIdx[guardian] > 0;
    }

    function getGuardian(address wallet, address _guardian)
        public
        view
        returns (Guardian memory guardian)
    {
        uint index = wallets[wallet].guardianIdx[_guardian];
        if (index > 0) {
            guardian = wallets[wallet].guardians[index-1];
        }
    }

    function guardians(address wallet)
        public
        view
        returns (Guardian[] memory)
    {
        return wallets[wallet].guardians;
    }

    function numGuardians(address wallet)
        public
        view
        returns (uint)
    {
        return wallets[wallet].guardians.length;
    }

    function addGuardian(address wallet, address guardian, uint info)
        public
        onlyManager
    {
        require(guardian != address(0), "ZERO_ADDRESS");
        Wallet storage w = wallets[wallet];
        require(w.guardianIdx[guardian] == 0, "GUARDIAN_EXISTS");

        Guardian memory g = Guardian(
            guardian,
            info
        );

        w.guardians.push(g);
        w.guardianIdx[guardian] = w.guardians.length;
    }

    function removeGuardian(address wallet, address guardian)
        public
        onlyManager
    {
        Wallet storage w = wallets[wallet];
        uint idx = w.guardianIdx[guardian];
        require(idx > 0, "GUARDIAN_NOT_EXISTS");

        Guardian memory lastGuardian = w.guardians[w.guardians.length - 1];

        if (guardian != lastGuardian.addr) {
            w.guardians[idx - 1] = lastGuardian;
            w.guardianIdx[lastGuardian.addr] = idx;
        }
        w.guardians.length -= 1;
        delete w.guardianIdx[guardian];
    }

    function isLocked(address wallet)
        public
        view
        returns (bool)
    {
        return uint(wallets[wallet].lock) > now;
    }

    function getLock(address wallet)
        public
        view
        returns (uint)
    {
        return uint(wallets[wallet].lock);
    }

    function setLock(address wallet, uint lock)
        public
        onlyManager
    {
        uint128 _lock = uint128(lock);
        require(uint(_lock) == lock, "LOCK_TOO_LARGE");

        wallets[wallet].lock = _lock;
        wallets[wallet].locker = msg.sender;
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