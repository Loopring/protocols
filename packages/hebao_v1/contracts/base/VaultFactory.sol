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
pragma solidity ^0.6.6;

import "./BaseVault.sol";

contract VaultFactory
{
    event VaultCreated(
        address indexed vault,
        uint    numOwners,
        uint    requirement
    );

    function createVault(
        address[] calldata owners,
        uint               requirement
        )
        external
        returns (address vault)
    {
        vault = address(new BaseVault(owners, requirement));
        emit VaultCreated(vault, owners.length, requirement);
    }
}
