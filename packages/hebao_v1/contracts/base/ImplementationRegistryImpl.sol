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

import "../iface/ImplementationRegistry.sol";


/// @title ImplementationRegistryImpl
/// @dev Basic implementation of an ImplementationRegistry.
///
/// @author Brecht Devos - <brecht@loopring.org>
contract ImplementationRegistryImpl is Claimable, AddressSet, ImplementationRegistry
{
    bytes32 internal constant IMPLEMENTATION = keccak256("__IMPLEMENTATION__");

    event ImplementationRegistered      (address indexed module);
    event ImplementationDeregistered    (address indexed module);
    event DefaultImplementationChanged  (address oldDefaultImplementation, address newDefaultImplementation);

    address internal _defaultImplementation;

    constructor() public Claimable() {}

    function registerImplementation(address implementation)
        external
        onlyOwner
    {
        addAddressToSet(IMPLEMENTATION, implementation, true);
        emit ImplementationRegistered(implementation);
    }

    function deregisterImplementation(address implementation)
        external
        onlyOwner
    {
        removeAddressFromSet(IMPLEMENTATION, implementation);
        emit ImplementationDeregistered(implementation);
    }

    function isImplementationRegistered(address implementation)
        public
        view
        returns (bool)
    {
        return isAddressInSet(IMPLEMENTATION, implementation);
    }

    function setDefaultImplementation(address implementation)
        external
        onlyOwner
    {
        require(implementation != _defaultImplementation, "DEFAULT_IMPLEMENTATION_UNCHANGED");
        require(isImplementationRegistered(implementation), "IMPLEMENTATION_NOT_REGISTERED");

        emit DefaultImplementationChanged(_defaultImplementation, implementation);

        _defaultImplementation = implementation;
    }

    function defaultImplementation()
        public
        view
        returns (address)
    {
        require(isImplementationRegistered(_defaultImplementation), "INVALID_DEFAULT_IMPLEMENTATION");
        return _defaultImplementation;
    }

    function implementations()
        public
        view
        returns (address[] memory)
    {
        return addressesInSet(IMPLEMENTATION);
    }

    function numOfImplementations()
        public
        view
        returns (uint)
    {
        return numAddressesInSet(IMPLEMENTATION);
    }
}