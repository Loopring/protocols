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

    mapping (bytes32 => address[]) addresses;
    mapping (bytes32 => mapping (address => uint)) positions;
    mapping (bytes32 => uint) count;


    function addAddressToSet(
        bytes32 key,
        address addr,
        bool maintainList
        ) internal
    {
        require(positions[key][addr] == 0, "ALREADY_IN_SET");

        if (maintainList) {
            addresses[key].push(addr);
            positions[key][addr] = addresses[key].length;
        } else {
            count[key] += 1;
            positions[key][addr] = count[key];
        }
    }

    function removeAddressFromSet(
        bytes32 key,
        address addr
        )
        internal
    {
        uint pos = positions[key][addr];
        require(pos != 0, "NOT_IN_SET");

        delete positions[key][addr];
        if (count[key] > 0) {
            count[key] -= 1;
        }

        if (addresses[key].length > 0) {
            address lastAddr = addresses[key][addresses[key].length - 1];
            if (lastAddr != addr) {
                addresses[key][pos - 1] = lastAddr;
                positions[key][lastAddr] = pos;
            }
            addresses[key].pop();
        }
    }

    function isAddressInSet(
        bytes32 key,
        address addr
        )
        internal
        view
        returns (bool)
    {
        return positions[key][addr] != 0;
    }

    function numAddressesInSet(bytes32 key)
        internal
        view
        returns (uint)
    {
        return count[key] + addresses[key].length;
    }

    function addressesInSet(bytes32 key)
        internal
        view
        returns (address[] memory)
    {
        require(count[key] == 0, "UNSUPPORTED");
        return addresses[key];
    }
}