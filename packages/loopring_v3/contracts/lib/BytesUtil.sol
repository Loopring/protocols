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

    function bytesToUint8(
        bytes memory b,
        uint  offset
        )
        internal
        pure
        returns (uint8)
    {
        return uint8(bytesToUintX(b, offset, 1) & 0xFF);
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

    function bytesToUint96(
        bytes memory b,
        uint  offset
        )
        internal
        pure
        returns (uint96)
    {
        return uint96(bytesToUintX(b, offset, 12) & 0xFFFFFFFFFFFFFFFFFFFFFFFF);
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
        internal
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
        internal
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

    function slice(
        bytes memory _bytes,
        uint _start,
        uint _length
    )
        internal
        pure
        returns (bytes memory)
    {
        require(_bytes.length >= (_start + _length));

        bytes memory tempBytes;

        assembly {
            switch iszero(_length)
            case 0 {
                // Get a location of some free memory and store it in tempBytes as
                // Solidity does for memory variables.
                tempBytes := mload(0x40)

                // The first word of the slice result is potentially a partial
                // word read from the original array. To read it, we calculate
                // the length of that partial word and start copying that many
                // bytes into the array. The first word we copy will start with
                // data we don't care about, but the last `lengthmod` bytes will
                // land at the beginning of the contents of the new array. When
                // we're done copying, we overwrite the full first word with
                // the actual length of the slice.
                let lengthmod := and(_length, 31)

                // The multiplication in the next line is necessary
                // because when slicing multiples of 32 bytes (lengthmod == 0)
                // the following copy loop was copying the origin's length
                // and then ending prematurely not copying everything it should.
                let mc := add(add(tempBytes, lengthmod), mul(0x20, iszero(lengthmod)))
                let end := add(mc, _length)

                for {
                    // The multiplication in the next line has the same exact purpose
                    // as the one above.
                    let cc := add(add(add(_bytes, lengthmod), mul(0x20, iszero(lengthmod))), _start)
                } lt(mc, end) {
                    mc := add(mc, 0x20)
                    cc := add(cc, 0x20)
                } {
                    mstore(mc, mload(cc))
                }

                mstore(tempBytes, _length)

                //update free-memory pointer
                //allocating the array padded to 32 bytes like the compiler does now
                mstore(0x40, and(add(mc, 31), not(31)))
            }
            //if we want a zero-length slice let's just return a zero-length array
            default {
                tempBytes := mload(0x40)

                mstore(0x40, add(tempBytes, 0x20))
            }
        }

        return tempBytes;
    }

    function toBytes4(bytes memory _bytes, uint _start) internal  pure returns (bytes4) {
        require(_bytes.length >= (_start + 4));
        bytes4 tempBytes4;

        assembly {
            tempBytes4 := mload(add(add(_bytes, 0x20), _start))
        }

        return tempBytes4;
    }
}
