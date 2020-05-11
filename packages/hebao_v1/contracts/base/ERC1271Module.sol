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

import "../thirdparty/ERC1271.sol";

import "../lib/MathUint.sol";
import "../lib/SignatureUtil.sol";
import "../thirdparty/BytesUtil.sol";

import "../iface/Wallet.sol";

import "./BaseModule.sol";


/// @title ERC1271Module
/// @dev This is the base module for supporting ERC1271.
contract ERC1271Module is ERC1271, BaseModule
{
    using SignatureUtil for bytes32;

    function bindableMethods()
        public
        pure
        override
        returns (bytes4[] memory methods)
    {
        methods = new bytes4[](1);
        methods[0] = this.isValidSignature.selector;
    }

    // Will use msg.sender to detect the wallet, so this function should be called through
    // the bounded method on the wallet itself, not directly on this module.
    function isValidSignature(
        bytes memory _data,
        bytes memory _signature)
        public
        view
        override
        returns (bytes4 magicValue)
    {
        bytes32 hash;
        if(_data.length == 32) {
            hash = BytesUtil.toBytes32(_data, 0);
        } else {
            hash = keccak256(_data);
        }
        if (hash.verifySignature(Wallet(msg.sender).owner(), _signature)) {
            return MAGICVALUE;
        } else {
            return 0;
        }
    }
}
