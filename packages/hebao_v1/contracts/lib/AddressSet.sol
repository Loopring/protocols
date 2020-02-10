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
pragma solidity ^0.6.0;


/// @title AddressSet
/// @author Daniel Wang - <daniel@loopring.org>
contract AddressSet
{
    struct Set
    {
        address[] addresses;
        mapping (address => uint) addressPos;
        uint count;
    }
    mapping (bytes32 => Set) private sets;

    function addAddressToSet(
        bytes32 key,
        address addr,
        bool maintainList
        ) internal
    {
        Set storage set = sets[key];
        require(set.addressPos[addr] == 0, "ALREADY_IN_SET");
        if (maintainList) {
            set.addresses.push(addr);
            set.addressPos[addr] = set.addresses.length;
        } else {
            require(set.addresses.length == 0, "MUST_MAINTAIN_LIST");
            set.addressPos[addr] = 1;
            set.count += 1;
        }
    }

    function removeAddressFromSet(
        bytes32 key,
        address addr
        )
        internal
    {
        Set storage set = sets[key];
        uint pos = set.addressPos[addr];
        require(pos != 0, "NOT_IN_SET");

        if (set.addresses.length > 0) {
            address lastAddr = set.addresses[set.addresses.length - 1];
            if (lastAddr != addr) {
                set.addresses[pos - 1] = lastAddr;
                set.addressPos[lastAddr] = pos;
            }
            set.addresses.pop();
        } else {
            set.count -= 1;
        }
        delete set.addressPos[addr];
    }

    function removeSet(bytes32 key)
        internal
    {
        delete sets[key];
    }

    function isAddressInSet(
        bytes32 key,
        address addr
        )
        internal
        view
        returns (bool)
    {
        return sets[key].addressPos[addr] != 0;
    }

    function numAddressesInSet(bytes32 key)
        internal
        view
        returns (uint)
    {
        Set storage set = sets[key];
        return set.addresses.length + set.count;
    }

    function addressesInSet(bytes32 key)
        internal
        view
        returns (address[] memory)
    {
        return sets[key].addresses;
    }
}