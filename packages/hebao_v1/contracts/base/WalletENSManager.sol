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
pragma solidity ^0.5.13;

import "../thirdparty/ens/BaseENSManager.sol";

/// @title Wallet
/// @dev Base contract for smart wallets.
///      Sub-contracts must NOT use non-default constructor to initialize
///      wallet states, instead, `init` shall be used. This is to enable
///      proxies to be deployed in front of the real wallet contract for
///      saving gas.
///
/// @author Daniel Wang - <daniel@loopring.org>
///
/// see https://github.com/ethereum/EIPs/blob/master/EIPS/eip-137.md
/// see https://github.com/ethereum/EIPs/blob/master/EIPS/eip-181.md
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
