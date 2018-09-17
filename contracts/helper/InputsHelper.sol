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

import "../impl/Data.sol";
import "../lib/MemoryUtil.sol";


/// @title InputsHelper
/// @author Daniel Wang - <daniel@loopring.org>.
library InputsHelper {

    function nextAddress(
        Data.Inputs inputs
        )
        internal
        pure
        returns (address value)
    {
        bytes memory b = inputs.data;
        uint offset = inputs.bytesOffset;
        assembly {
            value := mload(add(add(b, 20), offset))
        }
        inputs.bytesOffset += 20;
    }

    function nextUint(
        Data.Inputs inputs
        )
        internal
        pure
        returns (uint value)
    {
        bytes memory b = inputs.data;
        uint offset = inputs.bytesOffset;
        assembly {
            value := mload(add(add(b, 32), offset))
        }
        inputs.bytesOffset += 32;
    }

    function nextUint16(
        Data.Inputs inputs
        )
        internal
        pure
        returns (uint16 value)
    {
        bytes memory b = inputs.data;
        uint offset = inputs.bytesOffset;
        assembly {
            value := mload(add(add(b, 2), offset))
        }
        inputs.bytesOffset += 2;
    }

    function nextBytes(
        Data.Inputs inputs
        )
        internal
        pure
        returns (bytes value)
    {
        // We have stored the bytes arrays just like they are in stored in memory
        // so we can just copy the memory location at the given offset
        bytes memory data = inputs.data;
        uint offset = 32 + inputs.bytesOffset;
        assembly {
          value := add(data, offset)
        }
        inputs.bytesOffset += 32 + value.length;
    }
}
