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
        methods = new bytes4[](1);
        methods[0] = ERC1271.isValidSignature.selector;
    }

    // Will use msg.sender to detect the wallet, so this function should be called through
    // the bounded method on the wallet itself, not directly on this module.
    //
    // Note that we allow chained wallet ownership:
    // Wallet1 owned by Wallet2, Wallet2 owned by Wallet3, ..., WaleltN owned by an EOA.
    // The verificaiton of Wallet1's signature will succeed if the final EOA's signature is
    // valid.
    function isValidSignature(
        bytes32      _signHash,
        bytes memory _signature
        )
        public
        view
        override
        returns (bytes4 magicValue)
    {
        address wallet = msg.sender;
        if (controllerCache.securityStore.isLocked(wallet)) {
            return 0;
        }

        if (_signHash.verifySignature(Wallet(wallet).owner(), _signature)) {
            return ERC1271_MAGICVALUE;
        } else {
            return 0;
        }
    }
}
