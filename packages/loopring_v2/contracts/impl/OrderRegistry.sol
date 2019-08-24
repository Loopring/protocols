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
pragma solidity 0.5.7;

import "../iface/IOrderRegistry.sol";
import "../lib/NoDefaultFunc.sol";


/// @title An Implementation of IBrokerRegistry.
/// @author Daniel Wang - <daniel@loopring.org>.
contract OrderRegistry is IOrderRegistry, NoDefaultFunc {

    mapping (address => mapping (bytes32 => bool)) public hashMap;

    event OrderRegistered(address broker, bytes32 orderHash);

    function isOrderHashRegistered(
        address broker,
        bytes32 orderHash
        )
        external
        view
        returns (bool)
    {
        return hashMap[broker][orderHash];
    }

    function registerOrderHash(
        bytes32 orderHash
        )
        external
    {
        require(hashMap[msg.sender][orderHash] == false, ALREADY_EXIST);
        hashMap[msg.sender][orderHash] = true;
        emit OrderRegistered(msg.sender, orderHash);
    }
}
