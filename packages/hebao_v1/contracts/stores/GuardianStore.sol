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
contract GuardianStore is DataStore
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
        address addr,
        bool    includePendingActive
        )
        public
        view
        returns (bool)
    {
        Data.Guardian memory g = _getGuardian(wallet, addr);
        return g.addr != address(0) && _isActivatedOrPendingActivation(g, includePendingActive);
    }

    function guardians(
        address wallet,
        bool    includePendingActive
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
            if (_isActivatedOrPendingActivation(g,includePendingActive)) {
                _guardians[index] = g;
                index++;
            }
        }
        assembly { mstore(_guardians, index) }
    }

    function numGuardians(
        address wallet,
        bool    includePendingActive
        )
        public
        view
        returns (uint count)
    {
        Wallet storage w = wallets[wallet];
        for (uint i = 0; i < w.guardians.length; i++) {
            Data.Guardian memory g = w.guardians[i];
            if (_isActivatedOrPendingActivation(g, includePendingActive)) {
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

    function removeAllPendingGuardians(address wallet)
        public
        onlyWalletModule(wallet)
    {
        // Wallet storage w = wallets[wallet];
        // for (uint i = 0; i < w.guardians.length; i++) {
        //     delete w.guardianIdx[w.guardians[i].addr];
        // }
        // delete w.guardians;
    }

    function addGuardian(
        address wallet,
        address addr,
        uint    validSince
        )
        public
        onlyWalletModule(wallet)
    {
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
            if (_isPendingExpire(g)) {
                w.guardians[pos - 1].validUntil = 0;
            } else if (_isExpired(g)) {
                w.guardians[pos - 1].validUntil = 0;
                w.guardians[pos - 1].validSince = validSince.toUint40();
            }
        }
    }

    // ---- internal functions ---

    function _getGuardian(
        address wallet,
        address addr
        )
        internal
        view
        returns (Data.Guardian memory)
    {
        Wallet storage w = wallets[wallet];
        uint pos = w.guardianIdx[addr];
        if (pos > 0) {
            return w.guardians[pos - 1];
        }
    }

    function _isActivated(Data.Guardian memory guardian)
        internal
        view
        returns (bool)
    {
        return guardian.validSince > 0 &&
            guardian.validSince <= block.timestamp;
    }

    function _isPendingActivation(Data.Guardian memory guardian)
        internal
        view
        returns (bool)
    {
        return guardian.validSince > block.timestamp;
    }

    function _isExpired(Data.Guardian memory guardian)
        internal
        view
        returns (bool)
    {
        return guardian.validUntil > 0 &&
            guardian.validUntil <= block.timestamp;
    }

    function _isPendingExpire(Data.Guardian memory guardian)
        internal
        view
        returns (bool)
    {
        return guardian.validUntil > block.timestamp;
    }

    function _isActivatedOrPendingActivation(
        Data.Guardian memory guardian,
        bool includePendingActive
        )
        private
        view
        returns (bool)
    {
        if (_isExpired(guardian)) return false;
        return _isActivated(guardian) || includePendingActive && _isPendingActivation(guardian);
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
