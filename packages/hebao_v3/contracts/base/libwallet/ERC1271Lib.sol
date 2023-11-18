// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;
pragma experimental ABIEncoderV2;

import '../../lib/SignatureUtil.sol';
import './WalletData.sol';

/// @title ERC1271Lib
/// @author Brecht Devos - <brecht@loopring.org>
library ERC1271Lib {
    using SignatureUtil for bytes32;

    // Note that we allow chained wallet ownership:
    // Wallet1 owned by Wallet2, Wallet2 owned by Wallet3, ..., WaleltN owned by an EOA.
    // The verificaiton of Wallet1's signature will succeed if the final EOA's signature is
    // valid.
    function isValidSignature(
        Wallet storage wallet,
        bytes4 ERC1271_MAGICVALUE,
        bytes32 signHash,
        bytes memory signature
    ) public view returns (bytes4 magicValue) {
        if (wallet.locked) {
            return 0;
        }

        if (signHash.verifySignature(wallet.owner, signature)) {
            return ERC1271_MAGICVALUE;
        } else {
            return 0;
        }
    }
}
