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
pragma solidity 0.4.21;


/// @title Utility Functions for memory related operations
/// @author Brechtpd https://github.com/Brechtpd
library MemoryUtil {

    function getBytes32Pointer(
        bytes32[]   arr,
        uint offsetInWords
        )
        internal
        pure
        returns (uint ptr)
    {
        assembly {
            ptr := add(add(arr, 32), mul(offsetInWords, 32))
        }
    }

    function copyCallDataBytesInArray(
        uint parameterIndex,
        uint dst,
        uint offsetInBytes,
        uint numBytes
        )
        internal
        pure
    {
        assembly {
            let parameterOffset := add(calldataload(add(4, mul(parameterIndex, 32))), 4)
            calldatacopy(dst, add(add(parameterOffset, 32), offsetInBytes), numBytes)
        }
    }

    function bytesToUint(
        bytes b,
        uint offset
        )
        internal
        pure
        returns (uint data)
    {
        assembly {
            data := mload(add(add(b, 0x20), offset))
        }
    }
}
