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
pragma solidity ^0.6.6;


/// @title AddressSet
/// @author Daniel Wang - <daniel@loopring.org>
contract AddressSet
{
    struct Set
    {
        mapping (uint => address) addresses;
        mapping (address => uint) positions;
        uint count;
    }
    mapping (bytes32 => Set) private sets;

    function addAddressToSet(
        bytes32 key,
        address addr
        ) internal
    {
        Set storage set = sets[key];
        require(set.positions[addr] == 0, "ALREADY_IN_SET");

        set.count += 1;
        set.positions[addr] = set.count;
        set.addresses[set.count] = addr;
    }

    function removeAddressFromSet(
        bytes32 key,
        address addr
        )
        internal
    {
        Set storage set = sets[key];
        uint pos = set.positions[addr];
        require(pos != 0, "NOT_IN_SET");

        delete set.positions[addr];

        if (pos != set.count) {
            set.addresses[pos] = set.addresses[set.count];
        }
        delete set.addresses[set.count];

        set.count -= 1;
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
        return sets[key].positions[addr] != 0;
    }

    function numAddressesInSet(bytes32 key)
        internal
        view
        returns (uint)
    {
        Set storage set = sets[key];
        return set.count;
    }

    function addressesInSet(bytes32 key)
        internal
        view
        returns (address[] memory addrs)
    {
        Set storage set = sets[key];
        addrs = new address[](set.count);
        for (uint i = 0; i < set.count; i ++) {
            addrs[i] = set.addresses[i + 1];
        }
    }
}
