// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../iface/Wallet.sol";
import "../../lib/AddressUtil.sol";
import "../../lib/ERC1271.sol";
import "../../lib/SignatureUtil.sol";
import "../../thirdparty/BytesUtil.sol";
import "../security/SecurityModule.sol";


/// @title ERC1271Module
/// @dev This module enables our smart wallets to message signers.
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang - <daniel@loopring.org>
abstract contract ERC1271Module is ERC1271, SecurityModule
{
    using AddressUtil   for address;
    using BytesUtil     for bytes;
    using SignatureUtil for bytes;
    using SignatureUtil for bytes32;

    enum SignType {
        DEFAULT,  // = 0
        PERPETUAL // = 1
    }

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
        uint8 sigType = _signature.toUint8(0);

        if (sigType == uint8(SignType.DEFAULT)) {
            address wallet = msg.sender;
            if (securityStore.isLocked(wallet)) {
                return 0;
            }

            address _owner = Wallet(wallet).owner();
            bytes memory _sig = _signature.slice(8, _signature.length - 8);
            return _signHash.verifySignature(_owner, _sig) ? ERC1271_MAGICVALUE : bytes4(0);
        } else if (sigType == uint8(SignType.PERPETUAL)) {
            uint ownerIdx = _signature.toUint32(8);
            uint ownerTimestamp = _signature.toUint64(40);
            (address prevOwner, uint timestamp) = Wallet(msg.sender).previousOwner(ownerIdx);
            if (prevOwner == address(0) || timestamp != ownerTimestamp) {
                return 0;
            }

            bytes memory _sig = _signature.slice(104, _signature.length - 104);
            return _signHash.verifySignature(prevOwner, _sig) ? ERC1271_MAGICVALUE : bytes4(0);
        } else {
            return 0;
        }
    }
}
