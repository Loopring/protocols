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
pragma solidity ^0.5.11;

import "../thirdparty/ERC1271.sol";
import "../thirdparty/BytesUtil.sol";

import "./AddressUtil.sol";


/// @title SignatureUtil
/// @author Daniel Wang - <daniel@loopring.org>
library SignatureUtil
{

    bytes4 constant private ERC1271_MAGICVALUE = 0x20c13b0b;

    function verifySignatures(
        bytes32   signHash,
        address[] memory signers,
        bytes     memory signatures
        )
        public
        view
    {
        require(signers.length * 65 == signatures.length, "INVALID_DATA");

        address lastSigner;
        for (uint i = 0; i < signers.length; i++) {
            require(signers[i] > lastSigner, "INVALID_ORDER");
            lastSigner = signers[i];
            bytes memory sig = BytesUtil.slice(signatures, i * 65, 65);
            verifySignature(signHash, signers[i], sig);
        }
    }

    function verifySignature(
        bytes32 signHash,
        address signer,
        bytes   memory signature
        )
        public
        view
        returns (bool)
    {
        if (AddressUtil.isContract(signer)) {
            bytes memory callData = abi.encodeWithSelector(
                ERC1271(signer).isValidSignature.selector,
                signHash,
                signature
            );
            (bool success, bytes memory result) = signer.staticcall(callData);
            require(
                success &&
                result.length == 32 &&
                BytesUtil.toBytes4(result) == ERC1271_MAGICVALUE,
                "INVALID_SIGNATURE"
            );
        } else {
            require(
                recoverSigner(signHash, signature) == signer,
               "INVALID_SIGNATURE"
            );
        }
    }

    function recoverSigner(
        bytes32      signHash,
        bytes memory signature
        )
        public
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
}
