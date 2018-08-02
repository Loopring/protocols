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


/// @title An Implementation of IOrderbook.
/// @author Daniel Wang - <daniel@loopring.org>.
/// @author Kongliang Zhong - <kongliang@loopring.org>.
library OrderSpec {
    function hasDualAuth(uint16 spec)
        internal
        pure
        returns (bool)
    {
        return spec & 0x1 != 0;
    }

    function hasBroker(uint16 spec)
        internal
        pure
        returns (bool)
    {
        return spec & (1 << 1) != 0;
    }

    function hasOrderInterceptor(uint16 spec)
        internal
        pure
        returns (bool)
    {
        return spec & (1 << 2) != 0;
    }

    function hasWallet(uint16 spec)
        internal
        pure
        returns (bool)
    {
        return spec & (1 << 3) != 0;
    }

    function hasValidUntil(uint16 spec)
        internal
        pure
        returns (bool)
    {
        return spec & (1 << 4) != 0;
    }

    function allOrNone(uint16 spec)
        internal
        pure
        returns (bool)
    {
        return spec & (1 << 5) != 0;
    }

    function hasSignature(uint16 spec)
        internal
        pure
        returns (bool)
    {
        return spec & (1 << 6) != 0;
    }

    function hasDualAuthSig(uint16 spec)
        internal
        pure
        returns (bool)
    {
        return spec & (1 << 7) != 0;
    }

}
