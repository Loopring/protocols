// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;


library Data
{
    // Optimized to fit into 32 bytes (1 slot)
    enum GuardianStatus {
        INVALID,
        ADD,
        REMOVE
    }

    struct Guardian
    {
        address addr;
        uint8   status;
        uint64  timestamp; // validSince if status = ADD; validUntil if adding = REMOVE;
    }
}
