// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;


library Data
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
}
