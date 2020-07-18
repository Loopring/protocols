// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.6.10;

import "../base/DataStore.sol";
import "../lib/MathUint.sol";


/// @title HashStore
/// @dev This store maintains all hashes for SignedRequest.
contract HashStore is DataStore
{
    // wallet => hash => consumed
    mapping(address => mapping(bytes32 => bool)) public hashes;

    constructor() public {}

    function verifyAndUpdate(address wallet, bytes32 hash)
        public
        onlyWalletModule(wallet)
    {
        require(!hashes[wallet][hash], "HASH_EXIST");
        hashes[wallet][hash] = true;
    }
}
