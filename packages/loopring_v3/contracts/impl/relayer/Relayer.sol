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

import "./RelayerData.sol";

import "../../lib/Claimable.sol";
import "../../lib/ReentrancyGuard.sol";


/// @title An Implementation of IRelayer.
/// @author Brecht Devos - <brecht@loopring.org>
contract Relayer is Claimable, ReentrancyGuard, RelayerData
{
    function executeTransaction(
        address module,
        bytes memory transaction
        )
        public
        nonReentrant
    {
        require(modules[module], "UNAUTHORIZED_MODULE");
        (bool success, ) = module.delegatecall(transaction);
        require(success, "MODULE_DELEGATECALL_FAILED");
    }

    function setAuthorized(
        address module,
        bool authorized
        )
        external
        onlyOwner
    {
        modules[module] = authorized;
    }
}
