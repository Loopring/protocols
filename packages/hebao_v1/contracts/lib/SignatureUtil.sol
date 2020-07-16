// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.6.10;
pragma experimental ABIEncoderV2;

import "../thirdparty/BytesUtil.sol";
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
    
    bytes4 constant internal ERC1271_MAGICVALUE = 0x20c13b0b;

    bytes4 constant internal ERC1271_FUNCTION_WITH_BYTES_SELECTOR = bytes4(
        keccak256(bytes("isValidSignature(bytes,bytes)"))
    );

    bytes4 constant internal ERC1271_FUNCTION_WITH_BYTES32_SELECTOR = bytes4(
        keccak256(bytes("isValidSignature(bytes32,bytes)"))
    );
    
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
        return signer.isContract() ?
            verifyERC1271Signature(data, signer, signature) :
            verifyEOASignature(data, signer, signature);
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

    function verifyEOASignature(
        bytes   memory data,
        address signer,
        bytes   memory signature
        )
        private
        view
        returns (bool)
    {
        uint signatureTypeOffset = signature.length.sub(1);
        SignatureType signatureType = SignatureType(signature.toUint8(signatureTypeOffset));

        bytes memory stripped = signature.slice(0, signatureTypeOffset);
        bytes32 hash = getDataHash(data);

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
        returns (bool)
    {
        return verifyERC1271WithBytes(data, signer, signature) ||
            verifyERC1271WithBytes32(getDataHash(data), signer, signature);
    }

    function verifyERC1271WithBytes(
        bytes   memory data,
        address signer,
        bytes   memory signature
        )
        private
        view
        returns (bool)
    {
        bytes memory callData = abi.encodeWithSelector(
            ERC1271_FUNCTION_WITH_BYTES_SELECTOR,
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

    function verifyERC1271WithBytes32(
        bytes32 hash,
        address signer,
        bytes   memory signature
        )
        private
        view
        returns (bool)
    {
        bytes memory callData = abi.encodeWithSelector(
            ERC1271_FUNCTION_WITH_BYTES32_SELECTOR,
            hash,
            signature
        );
        (bool success, bytes memory result) = signer.staticcall(callData);
        return (
            success &&
            result.length == 32 &&
            result.toBytes4(0) == ERC1271_MAGICVALUE
        );
    }

    function getDataHash(bytes memory data)
        private
        pure
        returns (bytes32)
    {
        return (data.length == 32) ? BytesUtil.toBytes32(data, 0) : keccak256(data);
    }
}
