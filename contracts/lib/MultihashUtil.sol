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
pragma experimental "v0.5.0";
pragma experimental "ABIEncoderV2";

import "./BytesUtil.sol";


/// @title Utility Functions for Multihash signature verificaiton
/// @author Daniel Wang - <daniel@loopring.org>
/// For more information:
///   - https://github.com/saurfang/ipfs-multihash-on-solidity
///   - https://github.com/multiformats/multihash
///   - https://github.com/multiformats/js-multihash
library MultihashUtil {

    enum HashAlgorithm { Ethereum, EIP712 }

    string public constant SIG_PREFIX = "\x19Ethereum Signed Message:\n32";

    function verifySignature(
        address signer,
        bytes32 plaintext,
        bytes   multihash
        )
        internal
        pure
        returns (bool)
    {
        uint length = multihash.length;
        require(length >= 2, "invalid multihash format");
        uint8 algorithm;
        uint8 size;
        assembly {
            algorithm := mload(add(multihash, 1))
            size := mload(add(multihash, 2))
        }
        require(length == (2 + size), "bad multihash size");

        if (algorithm == uint8(HashAlgorithm.Ethereum)) {
            require(signer != 0x0, "invalid signer address");
            require(size == 65, "bad Ethereum multihash size");
            bytes32 hash;
            uint8 v;
            bytes32 r;
            bytes32 s;
            assembly {
                let data := mload(0x40)
                mstore(data, 0x19457468657265756d205369676e6564204d6573736167653a0a333200000000) // SIG_PREFIX
                mstore(add(data, 28), plaintext)                                                 // plaintext
                hash := keccak256(data, 60)                                                      // 28 + 32
                // Extract v, r and s from the multihash data
                v := mload(add(multihash, 3))
                r := mload(add(multihash, 35))
                s := mload(add(multihash, 67))
            }
            return signer == ecrecover(
                hash,
                v,
                r,
                s
            );
        } else if (algorithm == uint8(HashAlgorithm.EIP712)) {
            require(signer != 0x0, "invalid signer address");
            require(size == 65, "bad EIP712 multihash size");
            uint8 v;
            bytes32 r;
            bytes32 s;
            assembly {
                // Extract v, r and s from the multihash data
                v := mload(add(multihash, 3))
                r := mload(add(multihash, 35))
                s := mload(add(multihash, 67))
            }
            return signer == ecrecover(
                plaintext,
                v,
                r,
                s
            );
        } else {
            return false;
        }
    }
}

