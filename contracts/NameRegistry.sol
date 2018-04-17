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
pragma solidity 0.4.21;


/// @title Name Register Contract
/// @dev This contract maintains a name service for addresses and miner.
/// @author Kongliang Zhong - <kongliang@loopring.org>,
/// @author Daniel Wang - <daniel@loopring.org>,
contract NameRegistry {
    event NameRegistered (
        string            name,
        address   indexed owner
    );

    event NameUnregistered (
        string             name,
        address    indexed owner
    );

    event OwnershipTransfered (
        bytes12            name,
        address            oldOwner,
        address            newOwner
    );

    event AddressRegistered (
        bytes12           name,
        address   indexed owner,
        uint      indexed addressId,
        address           addr
    );

    event AddressUnregistered (
        uint    addressId,
        address owner
    );

    function registerName(string name) external;

    function unregisterName(string name) external;

    function transferOwnership(address newOwner) external;

    function addAddress(address addr) external returns (uint addressId);

    function removeAddress(uint addressId) external;

    function getAddress(uint id)
        external
        view
        returns (address addr);
}
