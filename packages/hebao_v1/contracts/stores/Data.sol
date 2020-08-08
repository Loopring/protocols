// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;


library Data
{
    struct Guardian
    {
        address addr;
        uint64  group;
        int64   timestamp; // If < 0, (0-timestamp) is the validUntil timestamp;
                           // If > 0, it is the validSince timestamp;
    }
}
