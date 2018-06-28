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
/// --------------------------------
/// | index    | field             |
/// --------------------------------
/// | 0        | orderSpecs length |
/// --------------------------------
/// | 1        | ringSpecs length  |
/// --------------------------------
/// | 2        | addressList length|
/// --------------------------------
/// | 3        | uintList length   |
/// --------------------------------
/// | 4        | bytesList length  |
/// --------------------------------
/// | 5 ~ 5+i  | ringSpecs i length|
/// --------------------------------
/// | 5+i+j ~  | bytes[j] length   |
/// --------------------------------
/// @title Encode spec for SumitRings parameters.
/// @author Kongliang - <kongliang@loopring.org>.
library EncodeSpec {
    function orderSpecSize(uint16[] spec)
        internal
        pure
        returns (uint16)
    {
        return spec[0];
    }

    function ringSpecSize(uint16[] spec)
        internal
        pure
        returns (uint16)
    {
        return spec[1];
    }

    /// i: index of ringSpecs[i], starts from 0.
    function ringSpecSizeI(uint16[] spec, uint i)
        internal
        pure
        returns (uint16)
    {
        uint ringSize = ringSpecSize(spec);
        require(i < ringSize);
        uint ind = 5 + i;
        return spec[ind];
    }

    function ringSpecSizeArray(uint16[] spec)
        internal
        pure
        returns (uint[] memory) {
        uint arrayLen = spec[1];
        uint[] memory sizeArray = new uint[](arrayLen);
        for (uint i = 0; i < arrayLen; i++) {
            sizeArray[i] = uint(spec[5 + i]);
        }
        return sizeArray;
    }

    function ringSpecsDataLen(uint16[] spec)
        internal
        pure
        returns (uint) {
        uint arrayLen = ringSpecSize(spec);
        uint dataLen = 0;
        for (uint i = 0; i < arrayLen; i++) {
            dataLen += ringSpecSizeI(spec,i);
        }
        return dataLen;
    }

    function addressListSize(uint16[] spec)
        internal
        pure
        returns (uint16)
    {
        return spec[2];
    }

    function uintListSize(uint16[] spec)
        internal
        pure
        returns (uint16)
    {
        return spec[3];
    }

    function bytesListSize(uint16[] spec)
        internal
        pure
        returns (uint16)
    {
        return spec[4];
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
