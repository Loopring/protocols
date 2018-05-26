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


/// @title Utility Functions for byte32
/// @author Kongliang Zhong - <kongliang@loopring.org>,
/// @author Daniel Wang - <daniel@loopring.org>.
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

    // This function assumes the contract was called using a function that has a single bytes array parameter
    function loadCallDataWord(
        uint offsetInBytes
        )
        internal
        pure
        returns (uint data)
    {
        assembly {
            // Offset 68 = 4 (function hash) + 32 (offset to bytes data) + 32 (array size)
            data := calldataload(add(68, offsetInBytes))
        }
    }

    // This function assumes the contract was called using a function that has a single bytes array parameter
    function copyCallDataBytes(
        uint dst,
        uint offsetInBytes,
        uint numBytes
        )
        internal
        pure
    {
        assembly {
            // Offset 68 = 4 (function hash) + 32 (offset to bytes data) + 32 (array size)
            calldatacopy(dst, add(68, offsetInBytes), numBytes)
        }
    }
}
