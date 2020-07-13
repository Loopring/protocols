// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.6.10;
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
    bytes4 constant private ERC1271_FUNCTION1_SELECTOR = bytes4(
        keccak256(bytes("isValidSignature(bytes,bytes)"))
    );

    bytes4 constant private ERC1271_FUNCTION2_SELECTOR = bytes4(
        keccak256(bytes("isValidSignature(bytes32,bytes)"))
    );

    using SignatureUtil for bytes;
    using SignatureUtil for bytes32;
    using AddressUtil   for address;

    constructor(ControllerImpl _controller)
        public
        BaseModule(_controller)
    {
    }

    function bindableMethods()
        public
        pure
        override
        returns (bytes4[] memory methods)
    {
        methods = new bytes4[](2);
        methods[0] = ERC1271_FUNCTION1_SELECTOR;
        methods[1] = ERC1271_FUNCTION2_SELECTOR;
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
        (uint _lock,) = controller.securityStore().getLock(msg.sender);
        if(_lock > now) { // wallet locked
            return 0;
        }

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
        (uint _lock,) = controller.securityStore().getLock(msg.sender);
        if(_lock > now) { // wallet locked
            return 0;
        }

        if (_hash.verifySignature(Wallet(msg.sender).owner(), _signature)) {
            return MAGICVALUE;
        } else {
            return 0;
        }
    }
}
