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

import "./MemoryUtil.sol";

/// @title Utility Functions for bytes
/// @author Daniel Wang - <daniel@loopring.org>
library BytesUtil {
    function bytesToBytes32(
        bytes b,
        uint offset
        )
        internal
        pure
        returns (bytes32 out)
    {
        require(b.length >= offset + 32);
        bytes32 temp;
        assembly {
            temp := mload(add(add(b, 0x20), offset))
        }
        return temp;
    }

    function copyToUint16Array(bytes b, uint offset, uint arraySize)
        internal
        pure
        returns (uint16[]) {
        uint16[] memory resultArray = new uint16[](arraySize);
        for (uint i = 0; i < arraySize; i++) {
            resultArray[i] = uint16(MemoryUtil.bytesToUintX(b, offset + i * 2, 2));
        }
        return resultArray;
    }

    function copyToUint8ArrayList(bytes b, uint offset, uint[] innerArraySizeList)
        internal
        pure
        returns (uint8[][] memory) {
        uint arraySize = innerArraySizeList.length;
        uint8[][] memory resultArray = new uint8[][](arraySize);
        /* for (uint i = 0; i < arraySize; i++) { */
        /*     uint len = innerArraySizeList[i]; */
        /*     uint8[] memory innerArray = new uint8[](len); */
        /*     for (uint j = 0; j < len; j++) { */
        /*         // innerArray[j] = uint8(MemoryUtil.bytesToUintX(b, offset + j * (i + 1), 1)); */
        /*     } */
        /*     resultArray[i] = innerArray; */
        /* } */
        return resultArray;
    }

    function copyToAddressArray(bytes b, uint offset, uint arraySize)
        internal
        pure
        returns (address[]) {
        address[] memory resultArray = new address[](arraySize);
        for (uint i = 0; i < arraySize; i++) {
            resultArray[i] = MemoryUtil.bytesToAddress(b, offset + i * 20);
        }
        return resultArray;
    }

    function copyToUintArray(bytes b, uint offset, uint arraySize)
        internal
        pure
        returns (uint[]) {
        uint[] memory resultArray = new uint[](arraySize);
        for (uint i = 0; i < arraySize; i++) {
            resultArray[i] = MemoryUtil.bytesToUint(b, offset + i * 32);
        }
        return resultArray;
    }

}
