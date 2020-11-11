// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../lib/AddressUtil.sol";
import "../../lib/ERC1271.sol";
import "../../lib/SignatureUtil.sol";
import "../../thirdparty/BytesUtil.sol";
import "../../base/Module.sol";
import "../../base/WalletDataLayout.sol";
import "../data/SecurityData.sol";


/// @title ERC1271Module
/// @dev This module enables our smart wallets to message signers.
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang - <daniel@loopring.org>
contract ERC1271Module is ERC1271, Module
{
    using SignatureUtil for bytes32;
    using AddressUtil   for address;
    using SecurityData  for WalletDataLayout.State;

    function bindableMethods()
        public
        override
        pure
        returns (bytes4[] memory methods)
    {
        methods = new bytes4[](1);
        methods[0] = this.isValidSignature.selector;
    }

    function isValidSignature(
        bytes32      _signHash,
        bytes memory _signature
        )
        public
        override
        view
        returns (bytes4 magicValue)
    {
        if (state.isLocked()) {
            return 0;
        }

        if (_signHash.verifySignature(thisWallet().owner(), _signature)) {
            return ERC1271_MAGICVALUE;
        } else {
            return 0;
        }
    }
}
