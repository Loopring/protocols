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
        address    locker; // the module locked/unlocked this wallet
        Data.Guardian[] guardians;
        mapping    (address => uint) guardianIdx;
        bool       recovering;
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
        returns (Data.Guardian memory guardian)
    {
        uint index = wallets[wallet].guardianIdx[_guardian];
        require(index > 0, "NOT_A_GUARDIAN");
        guardian = wallets[wallet].guardians[index-1];
    }

    function guardians(address wallet)
        public
        view
        returns (Data.Guardian[] memory)
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

    function addOrUpdateGuardian(address wallet, address guardian, uint group)
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
        } else {
            // Update the guardian
            w.guardians[pos-1].group = group;
        }
    }

    function removeGuardian(address wallet, address guardian)
        public
        onlyManager
    {
        Wallet storage w = wallets[wallet];
        uint idx = w.guardianIdx[guardian];
        require(idx > 0, "GUARDIAN_NOT_EXISTS");

        Data.Guardian memory lastGuardian = w.guardians[w.guardians.length - 1];

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

    function isRecovering(address wallet)
        public
        view
        returns (bool)
    {
        return wallets[wallet].recovering;
    }

    function setRecovering(address wallet, bool _recovering)
        public
        onlyManager
    {
        wallets[wallet].recovering = _recovering;
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