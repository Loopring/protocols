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


/// @title Utility Functions for bytes
/// @author Daniel Wang - <daniel@loopring.org>
library BytesUtil
{
    function bytesToBytes32(
        bytes memory b,
        uint  offset
        )
        internal
        pure
        returns (bytes32)
    {
        return bytes32(bytesToUintX(b, offset, 32));
    }

    function bytesToUint(
        bytes memory b,
        uint  offset
        )
        internal
        pure
        returns (uint)
    {
        return bytesToUintX(b, offset, 32);
    }

    function bytesToAddress(
        bytes memory b,
        uint  offset
        )
        internal
        pure
        returns (address)
    {
        return address(bytesToUintX(b, offset, 20) & 0x00FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF);
    }

    function bytesToUint16(
        bytes memory b,
        uint  offset
        )
        internal
        pure
        returns (uint16)
    {
        return uint16(bytesToUintX(b, offset, 2) & 0xFFFF);
    }

    function bytesToUint24(
        bytes memory b,
        uint  offset
        )
        internal
        pure
        returns (uint24)
    {
        return uint24(bytesToUintX(b, offset, 3) & 0xFFFFFF);
    }

    function bytesToUint32(
        bytes memory b,
        uint  offset
        )
        internal
        pure
        returns (uint32)
    {
        return uint32(bytesToUintX(b, offset, 4) & 0xFFFFFFFF);
    }

    function bytesToUint56(
        bytes memory b,
        uint  offset
        )
        internal
        pure
        returns (uint56)
    {
        return uint56(bytesToUintX(b, offset, 7) & 0xFFFFFFFFFFFFFF);
    }

    function bytesToUint64(
        bytes memory b,
        uint  offset
        )
        internal
        pure
        returns (uint64)
    {
        return uint64(bytesToUintX(b, offset, 8) & 0xFFFFFFFFFFFFFFFF);
    }

    function bytesToBytes4(
        bytes memory b,
        uint  offset
        )
        internal
        pure
        returns (bytes4 data)
    {
        return bytes4(bytesToBytesX(b, offset, 4) & 0xFFFFFFFF00000000000000000000000000000000000000000000000000000000);
    }

    function bytesToBytesX(
        bytes memory b,
        uint  offset,
        uint  numBytes
        )
        private
        pure
        returns (bytes32 data)
    {
        require(b.length >= offset + numBytes, "INVALID_SIZE");
        assembly {
            data := mload(add(b, add(32, offset)))
        }
    }

    function bytesToUintX(
        bytes memory b,
        uint  offset,
        uint  numBytes
        )
        private
        pure
        returns (uint data)
    {
        require(b.length >= offset + numBytes, "INVALID_SIZE");
        assembly {
            data := mload(add(add(b, numBytes), offset))
        }
    }

    function subBytes(
        bytes memory b,
        uint  offset
        )
        internal
        pure
        returns (bytes memory data)
    {
        require(b.length >= offset + 32, "INVALID_SIZE");
        assembly {
            data := add(add(b, 32), offset)
        }
    }

    function fastSHA256(
        bytes memory data
        )
        internal
        view
        returns (bytes32)
    {
        bytes32[] memory result = new bytes32[](1);
        bool success;
        assembly {
             let ptr := add(data, 32)
             success := staticcall(sub(gas(), 2000), 2, ptr, mload(data), add(result, 32), 32)
        }
        require(success, "SHA256_FAILED");
        return result[0];
    }
}
