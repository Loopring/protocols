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
    uint public delaySecs;

    mapping (bytes32 => uint[]) private timestampSets;

    event Whitelisted(
        address indexed wallet,
        address indexed addr,
        bool            whitelisted
    );

    constructor(uint _delaySecs) public {
        delaySecs = _delaySecs;
    }

    function addToWhitelist(
        address wallet,
        address addr
        )
        public
        onlyManager
    {
        addAddressToSet(walletKey(wallet), addr, true);
        timestampSets[walletKey(wallet)].push(now);
        emit Whitelisted(wallet, addr, true);
    }

    function removeFromWhitelist(
        address wallet,
        address addr
        )
        public
        onlyManager
    {
        bytes32 key = walletKey(wallet);
        uint pos = posInSet(key, addr);
        removeAddressFromSet(key, addr);
        uint[] storage tsSet = timestampSets[key];
        tsSet[pos - 1] = tsSet[tsSet.length - 1];
        tsSet.length -= 1;
        emit Whitelisted(wallet, addr, false);
    }

    function whitelist(address wallet)
        public
        view
        returns (address[] memory whitelisted, uint[] memory addTimestamps)
    {
        whitelisted = addressesInSet(walletKey(wallet));
        addTimestamps = timestampSets[walletKey(wallet)];
    }

    function isWhitelisted(
        address wallet,
        address addr)
        public
        view
        returns (bool)
    {
        uint pos = posInSet(walletKey(wallet), addr);
        if (pos > 0) {
            uint ts = timestampSets[walletKey(wallet)][pos - 1];
            return now - ts > delaySecs;
        } else {
            return false;
        }
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
