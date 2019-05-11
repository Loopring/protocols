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
pragma solidity 0.5.7;

import "..//iface/ICurve.sol";

import "../lib/MathUint.sol";
import "../lib/NoDefaultFunc.sol";

/// @title Implementation of IAuction.
/// @author Daniel Wang  - <daniel@loopring.org>
///
/// Let P0 and P1 be the min and max price, T be the duration,
/// let e = P1 - P0, and C be the curve parameter to control its shape:
/// then we have:
///   y = f(x) = (T-x)*e/(C*x+T)+P0
/// and
///   x = f(y) = (e-y+P0)*T/(C*(y-P0)+e), and if we let m = y-P0, then
///   x = f(y) = (e-m)*T/(C*m+e)

contract Curve is ICurve, NoDefaultFunc
{
    using MathUint for uint;

    function getParamC(
        uint M,
        uint T0,
        uint T
        )
        external
        pure
        returns (uint C)
    {
      require(T0.mul(M.add(1)) <= M.mul(T), "T0/T must <= M/(M+1)");

      C = (M.mul(T) / T0).sub(M).sub(1);
    }

    function xToY(
        uint C,
        uint P0,
        uint P1,
        uint T,
        uint x
        )
        public
        pure
        returns (uint y)
    {
        require(x >= 0 && x <= T, "invalid x");
        uint e = P1 - P0;
        y = (T.sub(x).mul(e) / C.mul(x).add(T)).add(P0);
    }

    function yToX(
        uint C,
        uint P0,
        uint P1,
        uint T,
        uint y
        )
        public
        pure
        returns (uint x)
    {
        require(y >= P0 && y <= P1, "invalid y");
        uint m = y - P0;
        uint e = P1 - P0;
        x = e.sub(m).mul(T) / C.mul(m).add(e);
    }
}
