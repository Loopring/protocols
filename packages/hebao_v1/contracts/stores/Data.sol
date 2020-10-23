// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;


library Data
{
    // Optimized to fit into 32 bytes (1 slot)
    struct Guardian
    {
        address addr;
        uint40  validSince;
        uint40  validUntil;
    }
}
