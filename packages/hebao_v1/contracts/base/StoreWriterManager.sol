// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../iface/IStoreWriterManager.sol";
import "../lib/OwnerManagable.sol";


/// @title IStoreWriterManager
/// @dev Implementation of a IVersionRegistry.
///
/// @author Daniel Wang - <daniel@loopring.org>
contract StoreWriterManager is OwnerManagable, IStoreWriterManager
{
    event AccessGranted(address version, bool);

    constructor() OwnerManagable() {}

    mapping (address => bool) private access;

    function isStoreWriter(address addr)
        public
        override
        virtual
        view
        returns (bool)
    {
        return access[addr];
    }

    function grantAccess(address addr)
        external
        onlyManager
    {
        require(access[addr] == false, "ALREADY_GRANTED");
        access[addr] = true;
        emit AccessGranted(addr, true);
    }

    function revokeAccess(address addr)
        external
        onlyManager
    {
        require(access[addr], "ALREADY_GRANTED");
        delete access[addr];
        emit AccessGranted(addr, false);
    }
}