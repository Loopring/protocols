// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;


// This contract is created to generate the ABI for
// interacting with the SecurityStore in the 1.0.2 release.
abstract contract SecurityStore_1_1_6
{
    struct Guardian
    {
        address  addr;
        uint     group;
        uint     validSince;
        uint     validUntil;
    }

    // @dev Returns guardians who are either active or pending addition.
    function guardians(address wallet)
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
