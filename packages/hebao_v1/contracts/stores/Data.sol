// SPDX-License-Identifier: Apache-2.0
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
