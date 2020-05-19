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

import "../../lib/SignatureUtil.sol";
import "../../thirdparty/ERC1271.sol";
import "../../thirdparty/BytesUtil.sol";

/// @title AddressSetWrapper
/// @author Freeman Zhong - <kongliang@loopring.org>
contract SignatureUtilWrapper
{
    using BytesUtil     for bytes;
    using MathUint      for uint;

    function verifySignature(
        bytes32 signHash,
        address signer,
        bytes   calldata signature
        )
        external
        view
        returns (bool)
    {
        return SignatureUtil.verifySignature(signHash, signer, signature);
    }

    function recoverECDSASigner(
        bytes32      signHash,
        bytes calldata signature
        )
        external
        view
        returns (address)
    {
        uint signatureTypeOffset = signature.length.sub(1);
        SignatureUtil.SignatureType signatureType =
            SignatureUtil.SignatureType(signature.toUint8(signatureTypeOffset));
        bytes memory stripped = signature.slice(0, signatureTypeOffset);

        if (signatureType == SignatureUtil.SignatureType.EIP_712) {
            return SignatureUtil.recoverECDSASigner(signHash, stripped);
        } else if (signatureType == SignatureUtil.SignatureType.ETH_SIGN) {
            bytes32 hash = keccak256(
                abi.encodePacked("\x19Ethereum Signed Message:\n32", signHash)
            );
            return SignatureUtil.recoverECDSASigner(hash, stripped);
        } else {
            return address(0);
        }
    }
}
