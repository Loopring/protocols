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

import "./AddressSet.sol";


contract Managable is AddressSet
{
    bytes32 internal constant MANAGER = keccak256("__MANAGED__");

    bool   internal allowToBecomeEmpty = false;
    bool   internal allowSelfRemoval   = false;

    event ManagerAdded  (address indexed manager);
    event ManagerRemoved(address indexed manager);

    modifier onlyManager
    {
        require(isManager(msg.sender), "NOT_A_MANAGER");
        _;
    }

    function initManager(address manager)
        public
    {
        require(numAddressesInSet(MANAGER) == 0, "INITIALIZED_ALREADY");
        addAddressToSet(MANAGER, manager, true);
    }

    function addManager(address manager)
        public
        onlyManager
    {
        addManagerInternal(manager);
    }

    function removeManager(address manager)
        public
        onlyManager
    {
        require(allowToBecomeEmpty || numAddressesInSet(MANAGER) > 1, "EMPTY_LIST_PROHIBITED");
        require(allowSelfRemoval || msg.sender != manager, "SELF_REMOVAL_PROHIBITED");
        removeAddressFromSet(MANAGER, manager);
        emit ManagerRemoved(manager);
    }

    function isManager(address addr)
        public
        view
        returns (bool)
    {
        return isAddressInSet(MANAGER, addr);
    }

    function addManagerInternal(address manager)
        internal
    {
        addAddressToSet(MANAGER, manager, true);
        emit ManagerAdded(manager);
    }
}