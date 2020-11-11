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

}
