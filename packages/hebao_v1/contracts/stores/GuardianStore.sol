// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../base/DataStore.sol";
import "../lib/MathUint.sol";
import "../stores/Data.sol";
import "../thirdparty/SafeCast.sol";


/// @title GuardianStore
///
/// @author Daniel Wang - <daniel@loopring.org>

abstract contract GuardianStore is DataStore
{
    using MathUint      for uint;
    using SafeCast      for uint;

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
        address addr,
        bool    includePendingAddition
        )
        public
        view
        returns (bool)
    {
        Data.Guardian memory g = _getGuardian(wallet, addr);
        return g.addr != address(0) &&
            _isActiveOrPendingAddition(g, includePendingAddition);
    }

    function guardians(
        address wallet,
        bool    includePendingAddition
        )
        public
        view
        returns (Data.Guardian[] memory _guardians)
    {
        Wallet storage w = wallets[wallet];
        _guardians = new Data.Guardian[](w.guardians.length);
        uint index = 0;
        for (uint i = 0; i < w.guardians.length; i++) {
            Data.Guardian memory g = w.guardians[i];
            if (g.addr != address(0) &&
                _isActiveOrPendingAddition(g, includePendingAddition)) {
                _guardians[index] = g;
                index++;
            }
        }
        assembly { mstore(_guardians, index) }
    }

    function numGuardians(
        address wallet,
        bool    includePendingAddition
        )
        public
        view
        returns (uint count)
    {
        Wallet storage w = wallets[wallet];
        for (uint i = 0; i < w.guardians.length; i++) {
            Data.Guardian memory g = w.guardians[i];
            if (g.addr != address(0) &&
                _isActiveOrPendingAddition(g, includePendingAddition)) {
                count++;
            }
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

    function cancelPendingGuardians(address wallet)
        public
        onlyWalletModule(wallet)
    {
        Wallet storage w = wallets[wallet];
        for (uint i = 0; i < w.guardians.length; i++) {
            Data.Guardian memory g = w.guardians[i];
            if (_isPendingAddition(g) && ) {
                w.guardians[i].status = uint8(Data.GuardianStatus.INVALID);
            }
            if (_isPendingRemoval(g)) {
                w.guardians[i].status = uint8(Data.GuardianStatus.ADD);
                w.guardians[i].timestamp = 0;
            }
        }
        _cleanExpiredGuardians(wallet);
    }

    function addGuardian(
        address wallet,
        address addr,
        uint    validSince,
        bool    alwaysOverride
        )
        public
        onlyWalletModule(wallet)
        returns (uint _validSince, uint _validUntil)
    {
        require(validSince > 0, "INVALID_VALID_SINCE");
        require(addr != address(0), "ZERO_ADDRESS");

        Wallet storage w = wallets[wallet];
        uint pos = w.guardianIdx[addr];

        if(pos == 0) {
            // Add the new guardian
            Data.Guardian memory g = Data.Guardian(
                addr,
                validSince.toUint40(),
                uint40(0)
            );
            w.guardians.push(g);
            w.guardianIdx[addr] = w.guardians.length;

            _cleanExpiredGuardians(wallet);
        } else {
            Data.Guardian memory g = w.guardians[pos - 1];
            bool isGuardianActive = _isActivated(g) && !_isExpired(g);

            // If this wallet is active, do nothing.
            if (!isGuardianActive) {
                w.guardians[pos - 1].validSince = validSince.toUint40();
                w.guardians[pos - 1].validUntil = 0;
            }
        }
    }

    function removeGuardian(
        address wallet,
        address addr,
        uint    validUntil,
        bool    alwaysOverride
        )
        public
        onlyWalletModule(wallet)
        returns (uint _validSince, uint _validUntil)
    {
        require(validUntil > 0, "INVALID_VALID_UNTIL");
        require(addr != address(0), "ZERO_ADDRESS");

        Wallet storage w = wallets[wallet];
        uint pos = w.guardianIdx[addr];
        require(pos > 0, "GUARDIAN_NOT_EXISTS");

        Data.Guardian memory g = w.guardians[pos - 1];

        if (alwaysOverride) {

        } else {

        }
    }

    // ---- internal functions ---

    function _getGuardian(
        address wallet,
        address addr
        )
        private
        view
        returns (Data.Guardian memory)
    {
        Wallet storage w = wallets[wallet];
        uint pos = w.guardianIdx[addr];
        if (pos > 0) {
            return w.guardians[pos - 1];
        }
    }

    function _isAdded(Data.Guardian memory guardian)
        private
        view
        returns (bool)
    {
        return guardian.status == uint8(Data.GuardianStatus.ADD) &&
            guardian.timestamp <= block.timestamp;
    }

    function _isPendingAddition(Data.Guardian memory guardian)
        private
        view
        returns (bool)
    {
        return guardian.status == uint8(Data.GuardianStatus.ADD) &&
            guardian.timestamp > block.timestamp;
    }

    function _isRemoved(Data.Guardian memory guardian)
        private
        view
        returns (bool)
    {
        return guardian.status == uint8(Data.GuardianStatus.REMOVE) &&
            guardian.timestamp <= block.timestamp;
    }

    function _isPendingRemoval(Data.Guardian memory guardian)
        private
        view
        returns (bool)
    {
         return guardian.status == uint8(Data.GuardianStatus.REMOVE) &&
            guardian.timestamp > block.timestamp;
    }

    function _isActive(Data.Guardian memory guardian)
        private
        view
        returns (bool)
    {
        return _isAdded(guardian) || _isPendingRemoval(guardian);
    }

    function _isActiveOrPendingAddition(
        Data.Guardian memory guardian,
        bool includePendingAddition
        )
        private
        view
        returns (bool)
    {
        return _isActive(guardian) || includePendingAddition && _isPendingAddition(guardian);
    }

    function _cleanExpiredGuardians(address wallet)
        private
    {
        Wallet storage w = wallets[wallet];
        uint count = w.guardians.length;
        if (count < 10) return;

        for (int i = int(count) - 1; i >= 0; i--) {
            Data.Guardian memory g = w.guardians[uint(i)];
            if (_isExpired(g)) {
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