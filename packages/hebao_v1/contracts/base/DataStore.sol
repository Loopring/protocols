// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../iface/IStoreAccessManager.sol";
/// @title DataStore
/// @dev Modules share states by accessing the same storage instance.
///      Using ModuleStorage will achieve better module decoupling.
///
/// @author Daniel Wang - <daniel@loopring.org>
abstract contract DataStore
{
    IStoreAccessManager public immutable accessManager;

    constructor(IStoreAccessManager _accessManager)
    {
        accessManager = _accessManager;
    }

    modifier onlyFromStoreAccessor()
    {
        requireStoreAccessor();
        _;
    }

    function requireStoreAccessor() view internal
    {
        require(accessManager.isAccessAllowed(msg.sender), "UNAUTHORIZED");
    }
}