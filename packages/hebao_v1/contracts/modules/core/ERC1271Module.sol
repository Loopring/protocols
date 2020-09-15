// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../iface/Wallet.sol";
import "../../lib/AddressUtil.sol";
import "../../lib/ERC1271.sol";
import "../../lib/SignatureUtil.sol";
import "../../thirdparty/BytesUtil.sol";
import "../base/BaseModule.sol";


/// @title ERC1271Module
/// @dev This module enables our smart wallets to message signers.
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang - <daniel@loopring.org>
abstract contract ERC1271Module is ERC1271, BaseModule
{
    using SignatureUtil for bytes;
    using SignatureUtil for bytes32;
    using AddressUtil   for address;

    function bindableMethodsForERC1271()
        internal
        pure
        returns (bytes4[] memory methods)
    {
        methods = new bytes4[](2);
        methods[0] = ERC1271_SELECTOR_BS;
        methods[1] = ERC1271_SELECTOR_B32;
    }

    // Will use msg.sender to detect the wallet, so this function should be called through
    // the bounded method on the wallet itself, not directly on this module.
    //
    // Note that we allow chained wallet ownership:
    // Wallet1 owned by Wallet2, Wallet2 owned by Wallet3, ..., WaleltN owned by an EOA.
    // The verificaiton of Wallet1's signature will succeed if the final EOA's signature is
    // valid.
    function isValidSignature(
        bytes memory _data,
        bytes memory _signature
        )
        public
        view
        override
        returns (bytes4 magicValue)
    {
        magicValue = isValidSignature(keccak256(_data), _signature);
        if (magicValue == ERC1271_MAGICVALUE_B32) {
            magicValue = ERC1271_MAGICVALUE_BS;
        }
    }

    function isValidSignature(
        bytes32      _hash,
        bytes memory _signature)
        public
        view
        override
        returns (bytes4)
    {
        address wallet = msg.sender;
        (uint _lock,) = controller().securityStore().getLock(wallet);
        if (_lock > block.timestamp) { // wallet locked
            return 0;
        }

        if (_hash.verifySignature(Wallet(wallet).owner(), _signature)) {
            return ERC1271_MAGICVALUE_B32;
        } else {
            return 0;
        }
    }
}
