// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.6.10;

import "../base/DataStore.sol";
import "../lib/MathUint.sol";


/// @title HashStore
/// @dev This store maintains all hashes for SignedRequest.
contract HashStore
{
    mapping(bytes32 => bool) public hashes;

    constructor() public {}

    function verifyAndUpdate(bytes32 hash)
        public
    {
        require(!hashes[hash], "HASH_EXIST");
        hashes[hash] = true;
    }
}
