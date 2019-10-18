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

import "../lib/Claimable.sol";

import "../iface/IAddressWhitelist.sol";

import "../thirdparty/ECDSA.sol";


/// @title An Implementation of IAddressWhitelist.
/// @author Daniel Wang  - <daniel@loopring.org>
contract SignatureBasedAddressWhitelist is Claimable, IAddressWhitelist
{
    uint public constant PERMISSION_TIMEOUT = 24 hours;

    constructor() Claimable() public {}

    function isAddressWhitelisted(
        address addr,
        bytes   memory permission
        )
        public
        view
        returns (bool)
    {
        if (permission.length != 73) {
            return false;
        }

        uint time;
        assembly {
            time := and(mload(add(permission, 8)), 0xFFFFFFFFFFFFFFFF) // first 8 bytes as time in second since epoch
        }

        if (time < now - PERMISSION_TIMEOUT) {
            return false;
        }

        bytes memory sig = new bytes(65);
        for (uint i = 0; i < 65; i++) {
            sig[i] = permission[i + 8];
        }

        bytes32 hash = keccak256(abi.encodePacked("LOOPRING_DEX_ACCOUNT_CREATION", addr, time));
        hash = ECDSA.toEthSignedMessageHash(hash);
        return owner == ECDSA.recover(hash, sig);
    }
}
