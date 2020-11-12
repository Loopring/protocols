// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../lib/EIP712.sol";
import "../../lib/SignatureUtil.sol";
import "../data/HashData.sol";
import "./GuardianUtils.sol";


/// @title SignedRequest
/// @dev Utility library for better handling of signed wallet requests.
///      This library must be deployed and linked to other modules.
///
/// @author Daniel Wang - <daniel@loopring.org>
library SignedRequest {
    using SignatureUtil for bytes32;
    using GuardianUtils for WalletDataLayout.State;
    using HashData      for WalletDataLayout.State;
    using GuardianData  for WalletDataLayout.State;

    struct Request {
        address[] signers;
        bytes[]   signatures;
        uint      validUntil;
    }

    function verifyRequest(
        WalletDataLayout.State storage S,
        bytes32                      domainSeperator,
        bytes32                      txAwareHash,
        GuardianUtils.SigRequirement sigRequirement,
        Request memory               request,
        bytes   memory               encodedRequest
        )
        public
    {
        require(block.timestamp <= request.validUntil, "EXPIRED_SIGNED_REQUEST");

        bytes32 _txAwareHash = EIP712.hashPacked(domainSeperator, encodedRequest);

        // If txAwareHash from the meta-transaction is non-zero,
        // we must verify it matches the hash signed by the respective signers.
        require(
            txAwareHash == 0 || txAwareHash == _txAwareHash,
            "TX_INNER_HASH_MISMATCH"
        );

        // Save hash to prevent replay attacks
        S.verifyAndUpdate(_txAwareHash);

        require(
            _txAwareHash.verifySignatures(request.signers, request.signatures),
            "INVALID_SIGNATURES"
        );

        require(S.requireMajority(request.signers, sigRequirement), "PERMISSION_DENIED");
    }
}
