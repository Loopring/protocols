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

import "../../base/BaseStorage.sol";


/// @title SecurityStorage
/// @dev TODO
///
/// @author Daniel Wang - <daniel@loopring.org>
///
/// The design of this contract is inspired by Argent's contract codebase:
/// https://github.com/argentlabs/argent-contracts
contract SecurityStorage is BaseStorage
{
    struct Wallet
    {
        uint128   lock;
        address   locker;
        address[] guardians;
        mapping   (address => uint) guardianIdx;
    }

    mapping (address => Wallet) public cells;

    constructor(address manager)
        public
        BaseStorage(manager)
    {}

    function isGuardian(address wallet, address guardian)
        public
        view
        returns (bool)
    {
        return cells[wallet].guardianIdx[guardian] > 0;
    }

    function guardians(address wallet)
        public
        view
        returns (address[] memory)
    {
        return cells[wallet].guardians;
    }

    function numGuardians(address wallet)
        public
        view
        returns (uint)
    {
        return cells[wallet].guardians.length;
    }

    function addGuardian(address wallet, address guardian)
        external
        onlyManager
    {
        require(guardian != address(0), "ZERO_ADDRESS");
        Wallet storage w = cells[wallet];
        require(w.guardianIdx[guardian] == 0, "GUARDIAN_EXISTS");

        w.guardians.push(guardian);
        w.guardianIdx[guardian] = w.guardians.length;
    }

    function removeGuardian(address wallet, address guardian)
        external
        onlyManager
    {
        Wallet storage w = cells[wallet];
        uint idx = w.guardianIdx[guardian];
        require(idx > 0, "GUARDIAN_NOT_EXISTS");

        address lastGuardian = w.guardians[w.guardians.length - 1];

        if (guardian != lastGuardian) {
          w.guardians[idx - 1] = lastGuardian;
          w.guardianIdx[lastGuardian] = idx;
        }
        w.guardians.length--;
        delete w.guardianIdx[guardian];
    }

    function isLocked(address wallet)
        public
        view
        returns (bool)
    {
        return uint(cells[wallet].lock) > now;
    }

    function getLock(address wallet)
        public
        view
        returns (uint)
    {
        return uint(cells[wallet].lock);
    }

    function setLock(address wallet, uint lock, address locker)
        external
        onlyManager
    {
        uint128 _lock = uint128(lock);
        require(uint(_lock) == lock, "LOCK_TOO_LARGE");

        cells[wallet].lock = _lock;
        cells[wallet].locker = locker;
    }
}