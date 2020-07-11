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
pragma solidity ^0.6.10;
pragma experimental ABIEncoderV2;

import "../thirdparty/BytesUtil.sol";
import "../thirdparty/ERC1271.sol";
import "./AddressUtil.sol";
import "./MathUint.sol";


/// @title SignatureUtil
/// @author Daniel Wang - <daniel@loopring.org>
/// @dev This method supports multihash standard. Each signature's first byte indicates
///      the signature's type, the second byte indicates the signature's length, therefore,
///      each signature will have 2 extra bytes prefix. Mulitple signatures are concatenated
///      together.
library SignatureUtil
{
    using BytesUtil     for bytes;
    using MathUint      for uint;
    using AddressUtil   for address;

    enum SignatureType {
        ILLEGAL,
        INVALID,
        EIP_712,
        ETH_SIGN,
        WALLET   // deprecated
    }

    bytes4 constant private ERC1271_MAGICVALUE = 0x20c13b0b;

    bytes4 constant private ERC1271_FUNCTION_SELECTOR =
        bytes4(keccak256(bytes("isValidSignature(bytes,bytes)")));

    function verifySignatures(
        bytes32   signHash,
        address[] memory signers,
        bytes[]   memory signatures
        )
        internal
        view
        returns (bool)
    {
        return verifySignatures(abi.encodePacked(signHash), signers, signatures);
    }

    function verifySignatures(
        bytes     memory data,
        address[] memory signers,
        bytes[]   memory signatures
        )
        internal
        view
        returns (bool)
    {
        require(signers.length == signatures.length, "BAD_SIGNATURE_DATA");
        address lastSigner;
        for (uint i = 0; i < signers.length; i++) {
            require(signers[i] > lastSigner, "INVALID_SIGNERS_ORDER");
            lastSigner = signers[i];
            if (!verifySignature(data, signers[i], signatures[i])) {
                return false;
            }
        }
        return true;
    }

    function verifySignature(
        bytes32 signHash,
        address signer,
        bytes   memory signature
        )
        internal
        view
        returns (bool)
    {
        return verifySignature(abi.encodePacked(signHash), signer, signature);
    }

    function verifySignature(
        bytes   memory data,
        address signer,
        bytes   memory signature
        )
        internal
        view
        returns (bool)
    {
        if (signer.isContract()) {
            return verifyERC1271Signature(data, signer, signature);
        }

        uint signatureTypeOffset = signature.length.sub(1);
        SignatureType signatureType = SignatureType(signature.toUint8(signatureTypeOffset));

        bytes memory stripped = signature.slice(0, signatureTypeOffset);
        bytes32 hash = (data.length == 32) ? BytesUtil.toBytes32(data, 0): keccak256(data);

        if (signatureType == SignatureType.EIP_712) {
            return recoverECDSASigner(hash, stripped) == signer;
        } else if (signatureType == SignatureType.ETH_SIGN) {
            hash = keccak256(
                abi.encodePacked("\x19Ethereum Signed Message:\n32", hash)
            );
            return recoverECDSASigner(hash, stripped) == signer;
        } else {
            return false;
        }
    }

    function verifyERC1271Signature(
        bytes   memory data,
        address signer,
        bytes   memory signature
        )
        private
        view
        returns(bool)
    {
        bytes memory callData = abi.encodeWithSelector(
            ERC1271_FUNCTION_SELECTOR,
            data,
            signature
        );
        (bool success, bytes memory result) = signer.staticcall(callData);
        return (
            success &&
            result.length == 32 &&
            result.toBytes4(0) == ERC1271_MAGICVALUE
        );
    }

    function recoverECDSASigner(
        bytes32      signHash,
        bytes memory signature
        )
        internal
        pure
        returns (address)
    {
        if (signature.length != 65) {
            return address(0);
        }

        bytes32 r;
        bytes32 s;
        uint8   v;
        // we jump 32 (0x20) as the first slot of bytes contains the length
        // we jump 65 (0x41) per signature
        // for v we load 32 bytes ending with v (the first 31 come from s) then apply a mask
        assembly {
            r := mload(add(signature, 0x20))
            s := mload(add(signature, 0x40))
            v := and(mload(add(signature, 0x41)), 0xff)
        }
        // See https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/cryptography/ECDSA.sol
        if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) {
            return address(0);
        }
        if (v == 27 || v == 28) {
            return ecrecover(signHash, v, r, s);
        } else {
            return address(0);
        }
    }

    function recoverECDSASigner(
        bytes memory data,
        bytes memory signature
        )
        internal
        pure
        returns (address)
    {
        bytes32 hash = (data.length == 32) ?
            BytesUtil.toBytes32(data, 0) :
            keccak256(data);

        return recoverECDSASigner(hash, signature);
    }
}
