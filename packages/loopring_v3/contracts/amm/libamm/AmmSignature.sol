// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../lib/SignatureUtil.sol";


/// @title AmmSignature
library AmmSignature
{
    using SignatureUtil     for bytes32;

    function verifySignature(
        bytes32        signHash,
        address        signer,
        bytes   memory signature
        )
        public
        view
        returns (bool)
    {
        return signHash.verifySignature(signer, signature);
    }
}