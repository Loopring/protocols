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
        returns (bool)
    {
        uint    t;
        bytes32 r;
        bytes32 s;
        uint8   v;

        if (permission.length != 73) {
            return false;
        }

        assembly {
            t := mload(add(permission, 8)) // first 8 bytes as time in second since epoch
            r := mload(add(permission, 40))
            s := mload(add(permission, 72))
            v := and(mload(add(permission, 73)), 255)
        }

        if (t < now - PERMISSION_TIMEOUT) {
            return false;
        }

        if (v < 27) {
            v += 27;
        }

        if (v != 27 && v != 28) {
            return false;
        }

        bytes32 hash = keccak256(abi.encode("LOOPRING_DEX_ACCOUNT_CREATION", addr, t));
        return owner == ecrecover(hash, v, r, s);
    }
}
