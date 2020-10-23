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
contract SecurityStore2 is DataStore
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
        return g.addr != address(0) &&
            (_isActive(g) || includePendingActive && _isPendingActive(g));
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
            if (_isActive(g) || includePendingActive && _isPendingActive(g)) {
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
            if (_isActive(g) || includePendingActive && _isPendingActive(g)) {
                count++;
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
        uint index = w.guardianIdx[addr];
        if (index > 0) {
            return w.guardians[index-1];
        }
    }

    function _isActive(Data.Guardian memory guardian)
        internal
        view
        returns (bool)
    {
        return guardian.validSince > 0 &&
            guardian.validSince <= block.timestamp &&
            !_isExpired(guardian);
    }

    function _isExpired(Data.Guardian memory guardian)
        internal
        view
        returns (bool)
    {
        return guardian.validUntil > 0 &&
            guardian.validUntil <= block.timestamp;
    }

    function _isPendingActive(Data.Guardian memory guardian)
        internal
        view
        returns (bool)
    {
        return guardian.validSince > block.timestamp;
    }
}
