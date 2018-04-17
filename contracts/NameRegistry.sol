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

import "./lib/StringUtil.sol";

/// @title Name Register Contract
/// @dev This contract maintains a name service for addresses and miner.
/// @author Kongliang Zhong - <kongliang@loopring.org>,
/// @author Daniel Wang - <daniel@loopring.org>,
contract NameRegistry {
    using StringUtil for string;

    uint public nextId = 0;

    mapping (uint    => AddressInfo) public addressInfoMap;
    mapping (address => NameInfo)    public nameInfoMap;
    mapping (bytes12 => address)     public ownerMap;
    mapping (address => string)      public nameMap;

    struct NameInfo {
        bytes12  name;
        uint[]   addressIds;
    }

    struct AddressInfo {
        address addr;
        bytes12 name;
        address owner;
    }

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

    event AddressInfoRegistered (
        bytes12           name,
        address   indexed owner,
        uint      indexed addressId,
        address           addr
    );

    event AddressInfoUnregistered (
        uint    addressId,
        address owner
    );

    function registerName(string name)
        external
    {
        require(name.checkStringLength(6, 12));

        bytes12 nameBytes = name.stringToBytes12();

        require(ownerMap[nameBytes] == 0x0);
        require(nameMap[msg.sender].stringToBytes12() == bytes12(0x0));

        nameInfoMap[msg.sender] = NameInfo(nameBytes, new uint[](0));
        ownerMap[nameBytes] = msg.sender;
        nameMap[msg.sender] = name;

        emit NameRegistered(name, msg.sender);
    }

    function unregisterName(string name)
        external
    {
        NameInfo storage nameInfo = nameInfoMap[msg.sender];
        uint[] storage addressIds = nameInfo.addressIds;
        bytes12 nameBytes = name.stringToBytes12();
        require(nameInfo.name == nameBytes);

        for (uint i = 0; i < addressIds.length; i++) {
            delete addressInfoMap[addressIds[i]];
        }

        delete nameInfoMap[msg.sender];
        delete nameMap[msg.sender];
        delete ownerMap[nameBytes];

        emit NameUnregistered(name, msg.sender);
    }

    function transferOwnership(address newOwner)
        external
    {
        require(newOwner != 0x0);
        require(nameInfoMap[newOwner].name.length == 0);

        NameInfo storage nameInfo = nameInfoMap[msg.sender];
        string storage name = nameMap[msg.sender];
        uint[] memory addressIds = nameInfo.addressIds;

        for (uint i = 0; i < addressIds.length; i ++) {
            AddressInfo storage p = addressInfoMap[addressIds[i]];
            p.owner = newOwner;
        }

        delete nameInfoMap[msg.sender];
        delete nameMap[msg.sender];

        nameInfoMap[newOwner] = nameInfo;
        nameMap[newOwner] = name;

        emit OwnershipTransfered(nameInfo.name, msg.sender, newOwner);
    }

    function addAddress(address addr)
        external
        returns (uint)
    {
        require(addr != 0x0);

        NameInfo storage nameInfo = nameInfoMap[msg.sender];
        bytes12 name = nameInfo.name;

        require(name.length > 0);

        AddressInfo memory addressInfo = AddressInfo(
            addr,
            name,
            msg.sender
        );

        uint addressId = ++nextId;
        addressInfoMap[addressId] = addressInfo;
        nameInfo.addressIds.push(addressId);

        emit AddressInfoRegistered(
            name,
            msg.sender,
            addressId,
            addr
        );

        return addressId;
    }

    function removeAddress(uint addressId)
        external
    {
        require(msg.sender == addressInfoMap[addressId].owner);

        NameInfo storage nameInfo = nameInfoMap[msg.sender];
        uint[] storage addressIds = nameInfo.addressIds;

        delete addressInfoMap[addressId];

        uint len = addressIds.length;
        for (uint i = 0; i < len; i ++) {
            if (addressId == addressIds[i]) {
                addressIds[i] = addressIds[len - 1];
                addressIds.length -= 1;
            }
        }

        emit AddressInfoUnregistered(addressId, msg.sender);
    }

    function getAddressById(uint id)
        external
        view
        returns (address addr)
    {
        AddressInfo storage addressSet = addressInfoMap[id];
        addr = addressSet.addr;
    }

    function getOwner(string name)
        external
        view
        returns (address)
    {
        bytes12 nameBytes = name.stringToBytes12();
        return ownerMap[nameBytes];
    }

}
