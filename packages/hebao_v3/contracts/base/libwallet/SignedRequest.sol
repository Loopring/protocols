// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../lib/EIP712.sol";
import "../../lib/SignatureUtil.sol";
import "./GuardianLib.sol";
import "./WalletData.sol";


/// @title SignedRequest
/// @dev Utility library for better handling of signed wallet requests.
///      This library must be deployed and linked to other modules.
///
/// @author Daniel Wang - <daniel@loopring.org>
library SignedRequest {
    using SignatureUtil for bytes32;

    function verifyRequest(
        Wallet storage wallet,
        bytes32        domainSeperator,
        SigRequirement sigRequirement,
        Request memory request,
        bytes   memory encodedRequest
        )
        internal
    {
        require(address(this) == request.wallet, "INVALID_WALLET");
        require(block.timestamp <= request.validUntil, "EXPIRED_SIGNED_REQUEST");

        bytes32 _hash = EIP712.hashPacked(domainSeperator, encodedRequest);

        // Save hash to prevent replay attacks
        require(!wallet.hashes[_hash], "HASH_EXIST");
        wallet.hashes[_hash] = true;

        require(
            _hash.verifySignatures(request.signers, request.signatures),
            "INVALID_SIGNATURES"
        );

        require(
            GuardianLib.requireMajority(
                wallet,
                request.signers,
                sigRequirement
            ),
            "PERMISSION_DENIED"
        );
    }
}
