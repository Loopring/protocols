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
pragma solidity ^0.6.10;

import "../../lib/AddressSet.sol";

/// @title AddressSetWrapper
/// @author Freeman Zhong - <kongliang@loopring.org>
contract AddressSetWrapper is AddressSet
{
    function add(
        bytes32 key,
        address addr,
        bool maintainList
        ) external
    {
        addAddressToSet(key, addr, maintainList);
    }

    function remove(
        bytes32 key,
        address addr
        )
        external
    {
        removeAddressFromSet(key, addr);
    }

    function removeAll(bytes32 key) external {
        removeSet(key);
    }

    function isInSet(bytes32 key, address addr) external view returns (bool) {
        return isAddressInSet(key, addr);
    }

    function numInSet(bytes32 key) external view returns (uint) {
        return numAddressesInSet(key);
    }

    function getAddresses(bytes32 key) external view returns (address[] memory) {
        return addressesInSet(key);
    }
}
