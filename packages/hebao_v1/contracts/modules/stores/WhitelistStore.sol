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
pragma solidity ^0.5.11;

import "../../lib/AddressSet.sol";

import "../../base/DataStore.sol";


/// @title WhitelistStore
/// @dev This store maintains a wallet's whitelisted addresses.
contract WhitelistStore is DataStore
{
    // wallet => whitelisted_addr => effective_since
    mapping(address => mapping(address => uint)) public timestampMap;

    event Whitelisted(
        address indexed wallet,
        address indexed addr,
        bool            whitelisted
    );

    constructor() public DataStore()
    {
    }

    function addToWhitelist(
        address wallet,
        address addr,
        uint    effectiveSince
        )
        public
        onlyManager
    {
        addAddressToSet(walletKey(wallet), addr, true);
        uint effective = effectiveSince >= now ? effectiveSince : now;
        timestampMap[wallet][addr] = effective;
        emit Whitelisted(wallet, addr, true);
    }

    function removeFromWhitelist(
        address wallet,
        address addr
        )
        public
        onlyManager
    {
        removeAddressFromSet(walletKey(wallet), addr);
        delete timestampMap[wallet][addr];
        emit Whitelisted(wallet, addr, false);
    }

    function whitelist(address wallet)
        public
        view
        returns (
            address[] memory addresses,
            uint[]    memory effectiveSince
        )
    {
        addresses = addressesInSet(walletKey(wallet));
        effectiveSince = new uint[](addresses.length);
        for (uint i = 0; i < addresses.length; i++) {
            effectiveSince[i] = timestampMap[wallet][addresses[i]];
        }
    }

    function isWhitelisted(
        address wallet,
        address addr)
        public
        view
        returns (
            bool isWhitelistedAndEffective,
            uint effectiveSince
        )
    {
        effectiveSince = timestampMap[wallet][addr];
        isWhitelistedAndEffective = effectiveSince > 0 && effectiveSince <= now;
    }

    function whitelistSize(address wallet)
        public
        view
        returns (uint)
    {
        return numAddressesInSet(walletKey(wallet));
    }

    function walletKey(address addr)
        private
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked("__WHITELIST__", addr));
    }
}
