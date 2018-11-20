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
library HashUtil {

    function calcSubmitBlockHash(
        uint256 root,
        uint256[] seqNos,
        address[] oldAccountants,
        address[] accountants,
        uint256 height)
        internal
        pure returns (bytes32)
    {
        bytes32 hash;
        //TODO
        return hash;
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

        uint8 v;
        bytes32 r;
        bytes32 s;
        assembly {                                              
            // Extract v, r and s from the multihash data
            v := mload(add(signature, 1))
            r := mload(add(signature, 33))
            s := mload(add(signature, 65))
        }
        return signer == ecrecover(
            hash,
            v,
            r,
            s
        );
    }
}