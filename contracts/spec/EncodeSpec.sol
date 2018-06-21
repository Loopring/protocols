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

/// encode spec expanlation:
/// uint16[]:
/// ------------------------------
/// | index | field              |
/// ------------------------------
/// | 0     | encodeSpecs length |
/// ------------------------------
/// | 1     | orderSpecs length  |
/// ------------------------------
/// | 2     | ringSpecs length   |
/// ------------------------------
/// | 3     | addressList length |
/// ------------------------------
/// | 4     | uintList length    |
/// ------------------------------
/// | 5     | bytesList length   |
/// ------------------------------
/// | 6     | ringSpecs i length |
/// ------------------------------
/// | 6     | bytes[i] length    |
/// ------------------------------
/// @title Encode spec for SumitRings parameters.
/// @author Kongliang - <kongliang@loopring.org>.
library EncodeSpec {
    function orderSpecSize(uint16[] spec)
        internal
        pure
        returns (uint16)
    {
        return spec[1];
    }

    function ringSpecSize(uint16[] spec)
        internal
        pure
        returns (uint16)
    {
        return spec[2];
    }

    /// i: index of ringSpecs[i], starts from 0.
    function ringSpecSizeI(uint16[] spec, uint i)
        internal
        pure
        returns (uint16)
    {
        uint ringSize = ringSpecSize(spec);
        require(i < ringSize);
        uint ind = 6 + i;
        return spec[ind];
    }

    function addressListSize(uint16[] spec)
        internal
        pure
        returns (uint16)
    {
        return spec[3];
    }

    function uintListSize(uint16[] spec)
        internal
        pure
        returns (uint16)
    {
        return spec[4];
    }

    function bytesListSize(uint16[] spec)
        internal
        pure
        returns (uint16)
    {
        return spec[5];
    }

    function bytesListSizeI(uint16[] spec, uint i)
        internal
        pure
        returns (uint16)
    {
        uint bytesListSize = bytesListSize(spec);
        require(i < bytesListSize);

        uint ringSize = ringSpecSize(spec);
        uint ind = 6 + ringSize + i;
        return spec[ind];
    }

}
