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
/// @author Freeman Zhong - <kongliang@loopring.org>
contract SimpleAddressSet
{
    mapping (address => bool) addresses;
    uint count;

    function addAddressToSet(
        address addr
        ) internal
    {
        require(!addresses[addr], "ALREADY_IN_SET");

        addresses[addr] = true;
        count += 1;
    }

    function removeAddressFromSet(
        address addr
        )
        internal
    {
        require(addresses[addr], "NOT_IN_SET");

        count -= 1;
        delete addresses[addr];
    }

    function isAddressInSet(
        address addr
        )
        internal
        view
        returns (bool)
    {
        return addresses[addr];
    }

    function numAddressesInSet()
        internal
        view
        returns (uint)
    {
        return count;
    }

}
