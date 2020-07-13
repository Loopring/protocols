// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.6.10;

import "../../thirdparty/ERC1271.sol";

import "../../lib/MathUint.sol";
import "../../lib/SignatureUtil.sol";
import "../../thirdparty/BytesUtil.sol";

import "../../iface/Wallet.sol";

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
        if (_data.length == 32) {
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
