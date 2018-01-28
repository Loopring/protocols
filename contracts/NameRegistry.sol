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
/// @author Daniel Wang - <daniel@loopring.org>,
contract NameRegistry {

    uint64 public nextId = 0;

    mapping (uint64  => Participant) public participantMap;
    mapping (address => NameInfo)    public nameInfoMap;
    mapping (bytes12 => address)     public ownerMap;

    struct NameInfo {
        bytes12  name;
        uint64[] participantIds;
    }

    struct Participant {
        address feeRecipient;
        address signer;
        bytes12 name;
        address owner;
    }

    event NameRegistered (
        string            name,
        address   indexed addr
    );

    event NameUnregistered (
        string             name,
        address    indexed addr
     );

    event OwnershipTransfered (
        bytes12            name,
        address            oldOwner,
        address            newOwner
    );

    event ParticipantRegistered (
        bytes12           name,
        address   indexed owner,
        uint64    indexed participantId,
        address           singer,
        address           feeRecipient
    );

    event ParticipantUnregistered (
        uint64  participantId,
        address owner
    );

    function registerName(string name)
        external
    {
        require(isNameValid(name));

        bytes12 nameBytes = stringToBytes12(name);

        require(ownerMap[nameBytes] == 0x0);
        require(nameInfoMap[msg.sender].name.length == 0);

        nameInfoMap[msg.sender] = NameInfo(nameBytes, new uint64[](0));
        ownerMap[nameBytes] = msg.sender;

        NameUnregistered(name, msg.sender);
    }

    function unregisterName(string name)
        external
    {
        var nameInfo = nameInfoMap[msg.sender];
        var participantIds = nameInfo.participantIds;
        bytes12 nameBytes = stringToBytes12(name);
        require(nameInfo.name == nameBytes);

        for (uint i = 0; i < participantIds.length; i ++) {
            delete participantMap[participantIds[i]];
        }

        delete nameInfoMap[msg.sender];
        delete ownerMap[nameBytes];

        NameUnregistered(name, msg.sender);
    }

    function transferOwnership(address newOwner)
        external
    {
        require(newOwner != 0x0);
        require(nameInfoMap[newOwner].name.length == 0);

        NameInfo storage nameInfo = nameInfoMap[msg.sender];
        uint64[] memory participantIds = nameInfo.participantIds;

        for (uint i = 0; i < participantIds.length; i ++) {
            Participant storage p = participantMap[participantIds[i]];
            p.owner = newOwner;
        }

        nameInfoMap[newOwner] = nameInfo;
        delete nameInfoMap[msg.sender];

        OwnershipTransfered(nameInfo.name, msg.sender, newOwner);
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

        NameInfo storage nameInfo = nameInfoMap[msg.sender];
        bytes12 name = nameInfo.name;

        require(name.length > 0);

        Participant memory participant = Participant(feeRecipient, singer, name, msg.sender);

        uint64 participantId = nextId++;
        participantMap[participantId] = participant;
        nameInfo.participantIds.push(participantId);

        ParticipantRegistered(
            name,
            msg.sender,
            participantId,
            singer,
            feeRecipient
        );
    }

    function removeParticipant(uint64 participantId)
        external
    {
        require(msg.sender == participantMap[participantId].owner);

        NameInfo storage nameInfo = nameInfoMap[msg.sender];
        uint64[] storage participantIds = nameInfo.participantIds;

        delete participantMap[participantId];

        uint len = participantIds.length;
        for (uint i = 0; i < len; i ++) {
            if (participantId == participantIds[i]) {
                participantIds[i] = participantIds[len - 1];
                participantIds.length --;
            }
        }

        ParticipantUnregistered(participantId, msg.sender);
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
