// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../lib/EIP712.sol";
import "../../lib/SignatureUtil.sol";
import "../ControllerImpl.sol";
import "./GuardianUtils.sol";


/// @title SignedRequest
/// @dev Utilitiy library for better handling of signed wallet requests.
///      This library must be deployed and link to other modules.
///
/// @author Daniel Wang - <daniel@loopring.org>
library SignedRequest {
    using SignatureUtil for bytes32;

    struct Request {
        address[] signers;
        bytes[]   signatures;
        uint      validUntil;
        address   wallet;
    }

    function verifyRequest(
        ControllerImpl               controller,
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

        // Save hash to prevent replay attacks
        controller.hashStore().verifyAndUpdate(request.wallet, _txAwareHash);

        // If txAwareHash from the mata-transaction is non-zero,
        // we must verify it matches the hash signed by the respective signers.
        require(
            txAwareHash == 0 || txAwareHash == _txAwareHash,
            "TX_INNER_HASH_MISMATCH"
        );

        require(
            _txAwareHash.verifySignatures(request.signers, request.signatures),
            "INVALID_SIGNATURES"
        );

        require(
            GuardianUtils.requireMajority(
                controller.securityStore(),
                request.wallet,
                request.signers,
                sigRequirement
            ),
            "PERMISSION_DENIED"
        );
    }
}
