// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.6.10;

import "../iface/ModuleRegistry.sol";
import "../lib/AddressSet.sol";
import "../lib/Claimable.sol";


/// @title ModuleRegistryImpl
/// @dev Basic implementation of a ModuleRegistry.
///
/// @author Daniel Wang - <daniel@loopring.org>
contract ModuleRegistryImpl is Claimable, AddressSet, ModuleRegistry
{
    bytes32 internal constant MODULE = keccak256("__MODULE__");

    event ModuleRegistered      (address indexed module);
    event ModuleDeregistered    (address indexed module);

    constructor() public Claimable() {}

    function registerModule(address module)
        external
        override
        onlyOwner
    {
        addAddressToSet(MODULE, module, true);
        emit ModuleRegistered(module);
    }

    function deregisterModule(address module)
        external
        override
        onlyOwner
    {
        removeAddressFromSet(MODULE, module);
        emit ModuleDeregistered(module);
    }

    function isModuleRegistered(address module)
        external
        view
        override
        returns (bool)
    {
        return isAddressInSet(MODULE, module);
    }

    function modules()
        external
        view
        override
        returns (address[] memory)
    {
        return addressesInSet(MODULE);
    }

    function numOfModules()
        external
        view
        override
        returns (uint)
    {
        return numAddressesInSet(MODULE);
    }
}