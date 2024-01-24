// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;
pragma experimental ABIEncoderV2;

import "../../lib/ERC1271.sol";
import "../../lib/SignatureUtil.sol";
import "../../thirdparty/BytesUtil.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/// @title AddressSetWrapper
/// @author Freeman Zhong - <kongliang@loopring.org>
contract SignatureUtilWrapper {
    using BytesUtil for bytes;
    using SafeMath for uint;

    function verifySignature(
        bytes32 signHash,
        address signer,
        bytes calldata signature
    ) external view returns (bool) {
        return SignatureUtil.verifySignature(signHash, signer, signature);
    }

    function recoverECDSASigner(
        bytes32 signHash,
        bytes calldata signature
    ) external pure returns (address) {
        uint signatureTypeOffset = signature.length.sub(1);
        SignatureUtil.SignatureType signatureType = SignatureUtil.SignatureType(
            signature.toUint8(signatureTypeOffset)
        );

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
