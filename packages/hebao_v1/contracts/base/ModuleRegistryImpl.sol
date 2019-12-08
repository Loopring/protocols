/*

  Copyright 2017 Loopring Project Ltd (Loopring Foundation).

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/
pragma solidity ^0.5.13;

import "../lib/AddressSet.sol";
import "../lib/Claimable.sol";

import "../iface/ModuleRegistry.sol";


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
        onlyOwner
    {
        addAddressToSet(MODULE, module, true);
        emit ModuleRegistered(module);
    }

    function deregisterModule(address module)
        external
        onlyOwner
    {
        removeAddressFromSet(MODULE, module);
        emit ModuleDeregistered(module);
    }

    function isModuleRegistered(address module)
        public
        view
        returns (bool)
    {
        return isAddressInSet(MODULE, module);
    }

    function modules()
        public
        view
        returns (address[] memory)
    {
        return addressesInSet(MODULE);
    }

    function numOfModules()
        public
        view
        returns (uint)
    {
        return numAddressesInSet(MODULE);
    }
}