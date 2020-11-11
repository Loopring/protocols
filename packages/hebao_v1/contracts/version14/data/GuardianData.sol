// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../base/WalletDataLayout.sol";

/// @title GuardianData
/// @author Daniel Wang - <daniel@loopring.org>
library GuardianData
{

    enum GuardianStatus {
        REMOVE,    // Being removed or removed after validUntil timestamp
        ADD        // Being added or added after validSince timestamp.
    }

    // Optimized to fit into 32 bytes (1 slot)
    struct Guardian
    {
        address addr;
        uint8   status;
        uint64  timestamp; // validSince if status = ADD; validUntil if adding = REMOVE;
    }

    function isGuardian(
        WalletDataLayout.State storage S,
        address addr,
        bool    includePendingAddition
        )
        internal
        view
        returns (bool)
    {
        address wallet = msg.sender;
        // Data.Guardian memory g = _getGuardian(wallet, addr);
        // return _isActiveOrPendingAddition(g, includePendingAddition);
    }

    function guardians(
        WalletDataLayout.State storage S,
        bool    includePendingAddition
        )
        internal
        view
        returns (GuardianData.Guardian[] memory _guardians)
    {
        // Wallet storage w = wallets[msg.sender];
        // _guardians = new Data.Guardian[](w.guardians.length);
        // uint index = 0;
        // for (uint i = 0; i < w.guardians.length; i++) {
        //     Data.Guardian memory g = w.guardians[i];
        //     if (_isActiveOrPendingAddition(g, includePendingAddition)) {
        //         _guardians[index] = g;
        //         index++;
        //     }
        // }
        // assembly { mstore(_guardians, index) }
    }

    function numGuardians(
        WalletDataLayout.State storage S,
        bool    includePendingAddition
        )
        internal
        view
        returns (uint count)
    {
                address wallet = msg.sender;
        // Wallet storage w = wallets[msg.sender];
        // for (uint i = 0; i < w.guardians.length; i++) {
        //     Data.Guardian memory g = w.guardians[i];
        //     if (_isActiveOrPendingAddition(g, includePendingAddition)) {
        //         count++;
        //     }
        // }
    }


     function removeGuardian(
        WalletDataLayout.State storage S,
        address addr,
        uint    validUntil,
        bool    alwaysOverride
        )
        internal
        returns (uint)
    {
        // require(validUntil >= block.timestamp, "INVALID_VALID_UNTIL");
        // require(addr != address(0), "ZERO_ADDRESS");

        // Wallet storage w = wallets[wallet];
        // uint pos = w.guardianIdx[addr];
        // require(pos > 0, "GUARDIAN_NOT_EXISTS");

        // Data.Guardian memory g = w.guardians[pos - 1];

        // if (_isAdded(g)) {
        //     w.guardians[pos - 1].status = uint8(Data.GuardianStatus.REMOVE);
        //     w.guardians[pos - 1].timestamp = validUntil.toUint64();
        //     return validUntil;
        // }

        // if (_isPendingAddition(g)) {
        //     w.guardians[pos - 1].status = uint8(Data.GuardianStatus.REMOVE);
        //     w.guardians[pos - 1].timestamp = 0;
        //     return 0;
        // }

        // if (_isPendingRemoval(g)) {
        //     if (!alwaysOverride) return g.timestamp;

        //     w.guardians[pos - 1].timestamp = validUntil.toUint64();
        //     return validUntil;
        // }

        // require(_isRemoved(g), "UNEXPECTED_RESULT");
        // return 0;
    }

    function removeAllGuardians(WalletDataLayout.State storage S)
        internal
    {
    }

    function cancelPendingGuardians(WalletDataLayout.State storage S)
        internal
    {
        // bool cancelled = false;
        // Wallet storage w = wallets[wallet];
        // for (uint i = 0; i < w.guardians.length; i++) {
        //     Data.Guardian memory g = w.guardians[i];
        //     if (_isPendingAddition(g)) {
        //         w.guardians[i].status = uint8(Data.GuardianStatus.REMOVE);
        //         w.guardians[i].timestamp = 0;
        //         cancelled = true;
        //     }
        //     if (_isPendingRemoval(g)) {
        //         w.guardians[i].status = uint8(Data.GuardianStatus.ADD);
        //         w.guardians[i].timestamp = 0;
        //         cancelled = true;
        //     }
        // }
        // if (cancelled) {
        //     requireStoreAccessor();
        // }
        // _cleanRemovedGuardians(wallet, true);
    }

}
