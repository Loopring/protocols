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

import "../../lib/MathUint.sol";

import "../../thirdparty/ERC1271.sol";

import "../../iface/Wallet.sol";

import "./SecurityModule.sol";


/// @title InheritanceModule
contract InheritanceModule is SecurityModule
{
    using SignatureUtil for bytes32;
    using AddressUtil   for address;

    uint public waitingPeriod;

    event Inherited(
        address indexed wallet,
        address indexed newOwner,
        uint            timstamp
    );

    constructor(
        SecurityStore _securityStore,
        uint          _waitingPeriod
        )
        public
        SecurityModule(_securityStore)
    {
        waitingPeriod = _waitingPeriod;
    }

    function staticMethods()
        public
        pure
        returns (bytes4[] memory methods)
    {
        methods = new bytes4[](1);
        methods[0] = this.ownerLastActive.selector;
    }

    function ownerLastActive(address wallet)
        public
        view
        returns (uint)
    {
        return securityStore.lastActive(wallet);
    }

    function inherit(
        address wallet
        )
        external
        nonReentrant
    {
        emit Inherited(wallet, address(0), now);
    }

    function extractMetaTxSigners(
        bytes4  method,
        address /*wallet*/,
        bytes   memory /*data*/
        )
        internal
        pure
        returns (address[] memory)
    {
        require(
            method == this.inherit.selector,
            "INVALID_METHOD"
        );
    }
}
