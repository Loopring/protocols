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
pragma experimental ABIEncoderV2;

import "../../iface/Wallet.sol";
import "../../lib/AddressUtil.sol";
import "../../lib/SignatureUtil.sol";
import "../../thirdparty/BytesUtil.sol";
import "../../thirdparty/ERC1271.sol";
import "../base/BaseModule.sol";


/// @title ERC1271Module
/// @dev This module enables our smart wallets to message signers.
contract ERC1271Module is ERC1271, BaseModule
{
    bytes4 constant private ERC1271_FUNCTION1_SELECTOR =
        bytes4(keccak256(bytes("isValidSignature(bytes,bytes)")));

    bytes4 constant private ERC1271_FUNCTION2_SELECTOR =
        bytes4(keccak256(bytes("isValidSignature(bytes32,bytes)")));

    using SignatureUtil for bytes;
    using SignatureUtil for bytes32;
    using AddressUtil   for address;

    constructor(ControllerImpl _controller)
        public
        BaseModule(_controller) {}

    function bindableMethods()
        public
        pure
        override
        returns (bytes4[] memory methods)
    {
        methods = new bytes4[](2);
        methods[0] = ERC1271_FUNCTION1_SELECTOR;
        methods[2] = ERC1271_FUNCTION2_SELECTOR;
    }

    // Will use msg.sender to detect the wallet, so this function should be called through
    // the bounded method on the wallet itself, not directly on this module.
    function isValidSignature(
        bytes memory _data,
        bytes memory _signature
        )
        public
        view
        override
        returns (bytes4 magicValue)
    {
        if (_data.verifySignature(Wallet(msg.sender).owner(), _signature)) {
            return MAGICVALUE;
        } else {
            return 0;
        }
    }

    function isValidSignature(
        bytes32      _hash,
        bytes memory _signature
        )
        public
        view
        returns (bytes4 magicValue)
    {
        if (_hash.verifySignature(Wallet(msg.sender).owner(), _signature)) {
            return MAGICVALUE;
        } else {
            return 0;
        }
    }
}
