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

import "../lib/OwnerManagable.sol";


/// @title DelayedDataStore
/// @dev Modules share states by accessing the same storage instance.
///      Using ModuleStorage will achieve better module decoupling.
///
/// @author Freeman Zhong - <kongliang@loopring.org>
///
/// The design of this contract is inspired by Argent's contract codebase:
/// https://github.com/argentlabs/argent-contracts
contract DelayedDataStore is OwnerManagable
{
    uint public delaySecs;
    mapping (bytes32 => mapping (address => uint)) addressTsMap;

    constructor(uint _delaySecs) public OwnerManagable() {
        delaySecs = _delaySecs;
    }

    function addAddressToSetWithDelay(
        bytes32 key,
        address addr,
        bool maintainList
        ) internal
    {
        addressTsMap[key][addr] = now;
        addAddressToSet(key, addr, maintainList);
    }

    function isAddressInDelayedSet(
        bytes32 key,
        address addr
        )
        internal
        view
        returns (bool)
    {
        return (now - addressTsMap[key][addr]) >= delaySecs
            && isAddressInSet(key, addr);
    }

}
