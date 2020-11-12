// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "./DataStore.sol";
import "./IStoreWriterManager.sol";
import "../lib/MathUint.sol";


/// @title HashStore
/// @dev This store maintains all hashes for SignedRequest.
contract HashStore is DataStore
{
    // wallet => hash => consumed
    mapping(address => mapping(bytes32 => bool)) public hashes;

    constructor(IStoreWriterManager accessManager) DataStore(accessManager) {}

    function verifyAndUpdate(address wallet, bytes32 hash)
        external
    {
        require(!hashes[wallet][hash], "HASH_EXIST");
        requireStoreAccessor();
        hashes[wallet][hash] = true;
    }
}
