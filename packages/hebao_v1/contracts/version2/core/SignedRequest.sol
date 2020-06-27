/*

  Copyright 2017 Loopring Project Ltd (Loopring Foundation).

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/
pragma solidity ^0.6.6;
pragma experimental ABIEncoderV2;

import "../../lib/EIP712.sol";
import "../../lib/SignatureUtil.sol";

import "../../version1/security/GuardianUtils.sol";

import "../ControllerV2.sol";

/// @title SignedRequest
/// @dev Utilitiy library for better handling of signed wallet requests.
///
/// @author Daniel Wang - <daniel@loopring.org>
library SignedRequest {
    using SignatureUtil for bytes32;

    struct Request {
        address[] signers;
        bytes[]   signatures;
        uint      nonce;
        address   wallet;
    }

    function verifyRequest(
        ControllerV2                 controller,
        bytes32                      domainSeperator,
        GuardianUtils.SigRequirement sigRequirement,
        Request memory               request,
        bytes   memory               encodedRequest
        )
        public
    {
        bytes32 txHash = EIP712.hashPacked(domainSeperator, keccak256(encodedRequest));
        require(
            txHash.verifySignatures(request.signers, request.signatures),
            "INVALID_SIGNATURES"
        );

        controller.nonceStore().verifyAndUpdateNonce(request.wallet, request.nonce);

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
