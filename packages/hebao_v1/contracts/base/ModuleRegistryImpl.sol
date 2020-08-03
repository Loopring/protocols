// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../iface/ModuleRegistry.sol";
import "../lib/AddressSet.sol";
import "../lib/Claimable.sol";


/// @title ModuleRegistryImpl
/// @dev Basic implementation of a ModuleRegistry.
///
/// @author Daniel Wang - <daniel@loopring.org>
contract ModuleRegistryImpl is Claimable, AddressSet, ModuleRegistry
{
    bytes32 internal constant ENABLED_MODULE = keccak256("__ENABLED_MODULE__");
    bytes32 internal constant ALL_MODULE     = keccak256("__ALL_MODULE__");

    event ModuleRegistered      (address module);
    event ModuleDeregistered    (address module);

    constructor() Claimable() {}

    function registerModule(address module)
        external
        override
        onlyOwner
    {
        addAddressToSet(ENABLED_MODULE, module, true);

        if (!isAddressInSet(ALL_MODULE, module)) {
            addAddressToSet(ALL_MODULE, module, false);
        }
        emit ModuleRegistered(module);
    }

    function disableModule(address module)
        external
        override
        onlyOwner
    {
        removeAddressFromSet(ENABLED_MODULE, module);
        emit ModuleDeregistered(module);
    }

    function isModuleEnabled(address module)
        external
        view
        override
        returns (bool)
    {
        return isAddressInSet(ENABLED_MODULE, module);
    }

    function isModuleRegistered(address module)
        external
        view
        override
        returns (bool)
    {
        return isAddressInSet(ALL_MODULE, module);
    }

    function enabledModules()
        external
        view
        override
        returns (address[] memory)
    {
        return addressesInSet(ENABLED_MODULE);
    }

    function numOfEnabledModules()
        external
        view
        override
        returns (uint)
    {
        return numAddressesInSet(ENABLED_MODULE);
    }
}