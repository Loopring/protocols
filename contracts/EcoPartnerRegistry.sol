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


/// @title Wallet Registery Contract
/// @dev This contract maintains a list of wallets, each wallet will be assigned
///      with an unique index which is associated with the wallet's addresses.
///      When an order is created, the wallet's index is used instead of its
///      addresses in order to reduce order byte-size.
/// @author Daniel Wang - <daniel@loopring.org>.
contract EcoPartnerRegistry {
    ////////////////////////////////////////////////////////////////////////////
    /// Structures                                                           ///
    ////////////////////////////////////////////////////////////////////////////
    struct EcoPartner {
        bytes16     name;
        address[]   addresses;
    }


    ////////////////////////////////////////////////////////////////////////////
    /// Variables                                                            ///
    ////////////////////////////////////////////////////////////////////////////

    EcoPartner[] public partners;

    mapping(bytes16  => uint) public nameMap;
    mapping(address  => uint) public addressMap;


    ////////////////////////////////////////////////////////////////////////////
    /// Public Functions                                                     ///
    ////////////////////////////////////////////////////////////////////////////

    /// @dev Disable default function.
    function () payable public {
        revert();
    }

    /// @dev Return the address of a partner at an given index.
    /// @param addrRef an encoding of the partner's id and an address index. 
    ///        The bits[0-8] are used for address index, bits[9-63] are used
    ///        for partner id. 
    function getEcoPartnerAddress(uint64 addrRef)
        external
        view
        returns (address)
    {
        uint partnerId = uint(addrRef >> 8);
        uint addrIdx = uint((addrRef << 56) >> 56);

        return partners[partnerId].addresses[addrIdx];
    }

    function register(bytes16 name)
        external
        returns (uint id)
    {
        require(nameMap[name] == 0);
        require(addressMap[msg.sender] == 0);

        id = partners.length + 1;

        var addrs = new address[](1);
        addrs[0] = msg.sender;
        partners[id] = EcoPartner(name, addrs);

        nameMap[name] = id;
        addressMap[msg.sender] = id;
    }
}
