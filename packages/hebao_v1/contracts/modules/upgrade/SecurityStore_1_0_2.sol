// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;


abstract contract SecurityStore_1_0_2
{
    struct Guardian
    {
        address  addr;
        uint     group;
        uint     validSince;
        uint     validUntil;
    }

    // @dev Returns guardians who are either active or pending addition.
    function guardiansWithPending(address wallet)
        public
        virtual
        view
        returns (Guardian[] memory _guardians);

    function inheritor(address wallet)
        public
        virtual
        view
        returns (address who, uint lastActive);
}