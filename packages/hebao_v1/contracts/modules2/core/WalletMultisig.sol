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

import "../../iface/Controller.sol";

import "../../lib/EIP712.sol";
import "../../lib/SignatureUtil.sol";

import "../../modules/security/GuardianUtils.sol";


library WalletMultisig {
    using SignatureUtil for bytes32;

    struct Request {
        address[] signers;
        bytes[]   signatures;
        uint      nonce;
        address   wallet;
    }


    bytes32 public constant REQUEST_TYPEHASH = keccak256(
        "WalletMultisig.Request(address[] signers,bytes[] signatures,uint256 nonce,address wallet)"
    );

    function hashRequest(Request memory request)
        public
        returns (bytes32)
    {
        return keccak256(
            abi.encode(
                REQUEST_TYPEHASH,
                keccak256(abi.encode(request.signers)),
                keccak256(abi.encode(request.signatures)),
                request.nonce,
                request.wallet
            )
        );
    }

    function verifyPermission(
        Controller controller,
        bytes32 domainSeperator,
        GuardianUtils.SigRequirement sigRequirement,
        Request memory request,
        bytes memory encodedRequest
        )
        public
    {
        controller.nonceStore().verifyNonce(request.wallet, request.nonce);
        controller.nonceStore().updateNonce(request.wallet);

        bytes32 txHash = EIP712.hashPacked(domainSeperator, keccak256(encodedRequest));
        require(txHash.verifySignatures(request.signers, request.signatures), "INVALID_SIGNATURES");

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
