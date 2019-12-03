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
pragma solidity ^0.5.11;

import "../lib/AddressSet.sol";
import "../lib/Claimable.sol";

import "../iface/RelayerRegistry.sol";


/// @title RelayerRegistryImpl
/// @dev Basic implementation of a RelayerRegistry.
///
/// @author Daniel Wang - <daniel@loopring.org>
contract RelayerRegistryImpl is Claimable, AddressSet, RelayerRegistry
{
    bytes32 internal constant RELAYER = keccak256("__RELAYER__");

    event RelayerRegistered      (address indexed relayer);
    event RelayerDeregistered    (address indexed relayer);

    constructor() public Claimable() {}

    function registerRelayer(address relayer)
        external
        onlyOwner
    {
        addAddressToSet(RELAYER, relayer, true);
        emit RelayerRegistered(relayer);
    }

    function deregisterRelayer(address relayer)
        external
        onlyOwner
    {
        removeAddressFromSet(RELAYER, relayer);
        emit RelayerDeregistered(relayer);
    }

    function isRelayerRegistered(address relayer)
        public
        view
        returns (bool)
    {
        return isAddressInSet(RELAYER, relayer) || numAddressesInSet(RELAYER) == 0;
    }

    function relayers()
        public
        view
        returns (address[] memory)
    {
        return addressesInSet(RELAYER);
    }

    function numOfRelayers()
        public
        view
        returns (uint)
    {
        return numAddressesInSet(RELAYER);
    }
}