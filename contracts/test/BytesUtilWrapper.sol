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

import "../lib/BytesUtil.sol";


/// @author Brecht Devos - <brecht@loopring.org>
contract BytesUtilWrapper {
    using BytesUtil for bytes;

    function bytesToBytes32(
        bytes b,
        uint offset
        )
        external
        pure
        returns (bytes32)
    {
        return b.bytesToBytes32(offset);
    }

    function bytesToUint(
        bytes b,
        uint offset
        )
        external
        pure
        returns (uint)
    {
        return b.bytesToUint(offset);
    }

    function bytesToAddress(
        bytes b,
        uint offset
        )
        external
        pure
        returns (address)
    {
        return b.bytesToAddress(offset);
    }

    function bytesToUint16(
        bytes b,
        uint offset
        )
        external
        pure
        returns (uint16)
    {
        return b.bytesToUint16(offset);
    }
}
