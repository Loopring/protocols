// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;


library Data
{
    // This struct should take less than 32 bytes.
    struct Guardian
    {
        address addr;
        uint8   group;
        int64   timestamp; // If < 0, `timestamp.abs` is the validUntil timestamp;
                           // If > 0, `timestamp` is the validSince timestamp;
    }
}
