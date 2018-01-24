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
    uint64 nextId = 1;

    mapping (uint64  => Participant) public participantMap;
    mapping (address => NamedGroup)  public namedGroupMap;
    mapping (bytes12 => address)     public nameMap;
    mapping (address => uint64)      public feeRecipientMap;

    struct NamedGroup {
        bytes12 name;
        uint64  rootId;
    }

    struct Participant {
        address feeRecipient;
        address signer;
        uint64  nextId;
    }

    event NamedGroupRegistered (
        string            name,
        address   indexed addr
    );

    event ParticipantRegistered (
        bytes12           name,
        address   indexed owner,
        uint64    indexed addressSetId,
        address           singer,
        address           feeRecipient
    );

    function registerName(string name)
        external
    {
        require(isNameValid(name));

        bytes12 nameBytes = stringToBytes12(name);

        require(nameMap[nameBytes] == 0x0);
        require(namedGroupMap[msg.sender].name.length == 0);

        nameMap[nameBytes] = msg.sender;
        namedGroupMap[msg.sender] = NamedGroup(nameBytes, 0);

        NamedGroupRegistered(name, msg.sender);
    }

    function addParticipant(address feeRecipient)
        external
    {
        addParticipant(feeRecipient, feeRecipient);
    }

    function addParticipant(
        address feeRecipient,
        address singer
        )
        public
    {
        require(feeRecipient != 0x0 && singer != 0x0);
        require(namedGroupMap[msg.sender].name.length > 0);

        uint64 addrSetId = nextId++;
        Participant memory addrSet = Participant(feeRecipient, singer, 0);

        NamedGroup storage group = namedGroupMap[msg.sender];

        if (group.rootId == 0) {
            group.rootId = addrSetId;
        } else {
            var _addrSet = participantMap[group.rootId];
            while (_addrSet.nextId != 0) {
                _addrSet = participantMap[_addrSet.nextId];
            }
            _addrSet.nextId == addrSetId;
        }

        participantMap[addrSetId] = addrSet;

        ParticipantRegistered(
            group.name,
            msg.sender,
            addrSetId,
            singer,
            feeRecipient
        );
    }

    function getParticipantById(uint64 id)
        external
        view
        returns (address feeRecipient, address signer)
    {
        Participant storage addressSet = participantMap[id];

        feeRecipient = addressSet.feeRecipient;
        signer = addressSet.signer;
    }

    function isNameValid(string name)
        internal
        pure
        returns (bool)
    {
        bytes memory temp = bytes(name);
        return temp.length >= 6 && temp.length <= 12;
    }

    function stringToBytes12(string str)
        internal
        pure
        returns (bytes12 result)
    {
        assembly {
            result := mload(add(str, 12))
        }
    }

}
