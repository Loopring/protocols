// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.6.10;


library Data
{
    struct Guardian
    {
        address  addr;
        uint     group;
        uint     validSince;
        uint     validUntil;
    }
}
