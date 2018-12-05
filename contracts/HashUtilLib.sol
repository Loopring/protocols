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
pragma solidity 0.4.24;

/// @title HashUtil
/// @author autumn84 - <yangli@loopring.org>.
library HashUtilLib {

    function calcSubmitBlockHash(
        uint256[] seqNos,
        address[] oldAccountants,
        address[] accountants,
        uint256 height,
        bytes32 root,
        address submitter
)
        internal
        pure returns (bytes32)
    {       
        return keccak256(toPackage(seqNos, oldAccountants, accountants, height, root, submitter));
    }

    function toPackage(
        uint256[] seqNos,
        address[] oldAccountants,
        address[] accountants,
        uint256 height,
        bytes32 root,
        address submitter
)
        internal
        pure returns (bytes)
    {
        return abi.encodePacked(
            seqNos.length,
            seqNos,
            oldAccountants.length,
            oldAccountants,
            accountants.length,
            accountants,
            height,
            root,
            submitter
        );
    }


     function verifySignature(
        address signer,
        bytes32 hash,
        bytes   signature
        )
        internal
        pure
        returns (bool)
    {
        uint length = signature.length;
        require(length == 65, "invalid signature length");

        bytes memory prefix = "\x19Ethereum Signed Message:\n32";
        bytes32 prefixedHash = keccak256(abi.encodePacked(prefix, hash));
        
        uint8 v;
        bytes32 r;
        bytes32 s;
        assembly {                                              
            // Extract v, r and s from the multihash data
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := mload(add(signature, 65))
        }
        return signer == ecrecover(
            prefixedHash,
            v,
            r,
            s
        );
    }


    function getSigner(
        bytes32 hash,
        bytes   signature
        )
        internal
        pure
        returns (address)
    {
        uint length = signature.length;
        require(length == 65, "invalid signature length");

        bytes memory prefix = "\x19Ethereum Signed Message:\n32";
        bytes32 prefixedHash =  keccak256(abi.encodePacked(prefix, hash));

        uint8 v;
        bytes32 r;
        bytes32 s;
        assembly {                                              
            // Extract v, r and s from the multihash data
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := mload(add(signature, 65))
        }
        return ecrecover(
            prefixedHash,
            v,
            r,
            s
        );
    }
}