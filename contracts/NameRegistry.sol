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
pragma solidity 0.4.18;

/// @title Ethereum Address Register Contract
/// @dev This contract maintains a name service for addresses and miner.
/// @author Kongliang Zhong - <kongliang@loopring.org>,
contract NameRegistry {
    uint32 id = 0;

    mapping (uint32 => AddressSet) public addressSetMap;
    mapping (address => NameInfo)  public nameInfoMap;
    mapping (bytes12 => address)   public nameMap;
    mapping (address => uint32)    public feeRecipientMap;

    struct NameInfo {
        bytes12 name;
        uint32  rootId;
    }

    struct AddressSet {
        address signer;
        address feeRecipient;
        uint32  nextId;
    }

    event NameRegistered(string name, address addr);
    event AddressSetRegistered(
        bytes12           name,
        address   indexed owner,
        uint32    indexed addressSetId,
        address           singer,
        address           feeRecipient
    );

    function registerName(string name) external {
        require(isValidName(name));
        require(nameMap[stringToBytes12(name)] == 0x0);
        require(nameInfoMap[msg.sender].name.length == 0);

        NameInfo memory nameInfo = NameInfo(stringToBytes12(name), 0);
        nameInfoMap[msg.sender] = nameInfo;
        nameMap[stringToBytes12(name)] = msg.sender;
        NameRegistered(name, msg.sender);
    }

    function addAddressSet(address feeRecipient) external {
        addAddressSet(0x0, feeRecipient);
    }

    function addAddressSet(address singer, address feeRecipient) public {
        require(nameInfoMap[msg.sender].name.length > 0);
        require(feeRecipient != 0x0);

        uint32 addrSetId = ++id;
        AddressSet memory addrSet = AddressSet(singer, feeRecipient, 0);

        var _nameInfo = nameInfoMap[msg.sender];
        if (_nameInfo.rootId == 0) {
            _nameInfo.rootId = addrSetId;
        } else {
            var _addrSet = addressSetMap[_nameInfo.rootId];
            while (_addrSet.nextId != 0) {
                _addrSet = addressSetMap[_addrSet.nextId];
            }
            _addrSet.nextId == addrSetId;
        }

        addressSetMap[addrSetId] = addrSet;

        AddressSetRegistered(
            _nameInfo.name,
            msg.sender,
            addrSetId,
            singer,
            feeRecipient
        );
    }

    function getAddressesById(uint32 addrSetId) external view returns (address[]) {
        var _addressSet = addressSetMap[addrSetId];

        var addrs = new address[](2);
        addrs[0] = _addressSet.signer;
        addrs[1] = _addressSet.feeRecipient;
        return addrs;
    }

    function isValidName(string name) internal pure returns (bool) {
        bytes memory tempBs = bytes(name);

        // name's length should be greater than 0 and less than 13.
        return tempBs.length > 0 && tempBs.length < 13;
    }

    function stringToBytes12(string source) internal pure returns (bytes12 result) {
        bytes memory tempBs = bytes(source);
        if (tempBs.length == 0) {
            return 0x0;
        }

        assembly {
            result := mload(add(source, 12))
        }
    }

}
