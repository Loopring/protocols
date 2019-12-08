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

import "../thirdparty/ens/BaseENSManager.sol";

/// @title WalletENSManager
/// @dev An ENS manager to interactive with ENS module.
///
/// @author Daniel Wang - <daniel@loopring.org>
///
/// The design of this contract is inspired by Argent's contract codebase:
/// https://github.com/argentlabs/argent-contracts
contract WalletENSManager is BaseENSManager {

    constructor(
        string memory _rootName,
        bytes32       _rootNode,
        address       _ensRegistry,
        address       _ensResolver
        )
        public
        BaseENSManager(
            _rootName,
            _rootNode,
            _ensRegistry,
            _ensResolver
        )
    {
    }

}
