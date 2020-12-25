// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../iface/IVersionRegistry.sol";
import "../lib/OwnerManagable.sol";


/// @title VersionRegistry
/// @dev Implementation of a IVersionRegistry.
///
/// @author Daniel Wang - <daniel@loopring.org>
contract VersionRegistry is OwnerManagable, IVersionRegistry
{
    event VersionRegistered(address version, uint);

    constructor() OwnerManagable() {}

    mapping (address => uint) private versionNumbers;
    address[] public versions;

    function getVersionNumber(address version)
        public
        override
        view
        returns (uint)
    {
        return versionNumbers[version];
    }

    function registerVersion(address version)
        external
        onlyManager
    {
        require(versionNumbers[version] == 0, "REGISTERED_ALREADY");
        versions.push(version);
        uint number = versions.length;
        versionNumbers[version] = number;
        emit VersionRegistered(version, number);
    }

    function unregisterVersion(address version)
        external
        onlyManager
    {
        require(versionNumbers[version] > 0, "NOT_REGISTERED_YET");
        versionNumbers[version] = 0;
        emit VersionRegistered(version, 0);
    }
}