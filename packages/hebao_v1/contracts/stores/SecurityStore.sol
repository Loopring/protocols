// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../base/DataStore.sol";
import "../lib/MathUint.sol";
import "../stores/Data.sol";
import "../thirdparty/SafeCast.sol";


/// @title SecurityStore
///
/// @author Daniel Wang - <daniel@loopring.org>
///
/// The design of this contract is inspired by Argent's contract codebase:
/// https://github.com/argentlabs/argent-contracts
contract SecurityStore is DataStore
{
    using MathUint for uint;
    using SafeCast for uint;

    struct Wallet
    {
        address    inheritor;
        uint32     inheritWaitingPeriod;
        uint64     lastActive; // the latest timestamp the owner is considered to be active
        bool       locked;

        Data.Guardian[]            guardians;
        mapping (address => uint)  guardianIdx;
    }

    mapping (address => Wallet) public wallets;

    constructor() DataStore() {}

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
        return guardian.addr != address(0) &&
            (isGuardianActive(guardian) || isGuardianPendingAddition(guardian));
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
        uint    validSince
        )
        public
        onlyWalletModule(wallet)
    {
        cleanRemovedGuardians(wallet);

        require(guardianAddr != address(0), "ZERO_ADDRESS");
        Wallet storage w = wallets[wallet];

        uint pos = w.guardianIdx[guardianAddr];
        if (pos == 0) {
            // Add the new guardian
            Data.Guardian memory g = Data.Guardian(
                guardianAddr,
                validSince.toUint40(),
                uint40(0)
            );
            w.guardians.push(g);
            w.guardianIdx[guardianAddr] = w.guardians.length;
        } else {
            require(
                isGuardianPendingRemoval(w.guardians[pos - 1]),
                "NOT_PENDING_REMOVAL"
            );
            w.guardians[pos - 1].validUntil = 0;
        }
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

        if (isGuardianPendingAddition(w.guardians[idx - 1])) {
            Data.Guardian memory lastGuardian = w.guardians[w.guardians.length - 1];
            if (guardianAddr != lastGuardian.addr) {
                w.guardians[idx - 1] = lastGuardian;
                w.guardianIdx[lastGuardian.addr] = idx;
            }
            w.guardians.pop();
            delete w.guardianIdx[guardianAddr];
        } else {
            w.guardians[idx - 1].validUntil = validUntil.toUint40();
        }
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

    function isLocked(address wallet)
        public
        view
        returns (bool)
    {
        return wallets[wallet].locked;
    }

    function setLock(
        address wallet,
        bool    locked
        )
        public
        onlyWalletModule(wallet)
    {
        wallets[wallet].locked = locked;
    }

    function lastActive(address wallet)
        public
        view
        returns (uint)
    {
        return wallets[wallet].lastActive;
    }

    function touchLastActive(address wallet)
        public
        onlyWalletModule(wallet)
    {
        wallets[wallet].lastActive = uint64(block.timestamp);
    }

    function touchLastActiveWhenRequired(
        address wallet,
        uint    minInternval
        )
        public
    {
        if (block.timestamp > lastActive(wallet) + minInternval) {
            requireWalletModule(wallet);
            wallets[wallet].lastActive = uint64(block.timestamp);
        }
    }

    function inheritor(address wallet)
        public
        view
        returns (
            address _who,
            uint    _effectiveTimestamp
        )
    {
        address _inheritor = wallets[wallet].inheritor;
        if (_inheritor == address(0)) {
             return (address(0), 0);
        }

        uint32 _inheritWaitingPeriod = wallets[wallet].inheritWaitingPeriod;
        if (_inheritWaitingPeriod == 0) {
            return (address(0), 0);
        }

        uint64 _lastActive = wallets[wallet].lastActive;

        if (_lastActive == 0) {
            _lastActive = uint64(block.timestamp);
        }

        _who = _inheritor;
        _effectiveTimestamp = _lastActive + _inheritWaitingPeriod;
    }

    function setInheritor(
        address wallet,
        address who,
        uint32 _inheritWaitingPeriod
        )
        public
        onlyWalletModule(wallet)
    {
        wallets[wallet].inheritor = who;
        wallets[wallet].inheritWaitingPeriod = _inheritWaitingPeriod;
        wallets[wallet].lastActive = uint64(block.timestamp);
    }

    function isGuardianActive(Data.Guardian memory guardian)
        private
        view
        returns (bool)
    {
        return guardian.validSince > 0 && guardian.validSince <= block.timestamp &&
            !isGuardianExpired(guardian);
    }

    function isGuardianPendingAddition(Data.Guardian memory guardian)
        private
        view
        returns (bool)
    {
        return guardian.validSince > block.timestamp;
    }

    function isGuardianPendingRemoval(Data.Guardian memory guardian)
        private
        view
        returns (bool)
    {
        return guardian.validUntil > block.timestamp;
    }

    function isGuardianExpired(Data.Guardian memory guardian)
        private
        view
        returns (bool)
    {
        return guardian.validUntil > 0 &&
            guardian.validUntil <= block.timestamp;
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

}
