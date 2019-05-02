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

import "../iface/ICurve.sol";

import "../lib/MathUint.sol";
import "../lib/NoDefaultFunc.sol";

/// @title An Implementation of ICurve.
/// @author Daniel Wang  - <daniel@loopring.org>
contract DefaultCurve is ICurve, NoDefaultFunc
{
    using MathUint          for uint;
    using MathUint          for uint64;
    string name = "default";


    // Let c = P*M, d = P/M, and e = c-d,
    // and  use A as the curve parameter to control
    // it shape, then we use this curve:
    // ```y = f(x) = ((c-d)(T-x)/(A*x+T))+d```
    // and
    // ```x = f(y) = T*(c-d)/(A*y+c-d-A*d))```

    uint A = 3; // If A is 0, then the curve is a stright line.

    function getCurveValue(
        uint64  P, // target price
        uint8   M, // price factor
        uint    T,
        uint    x
        )
        public
        view
        returns (uint y)
    {
        uint c = P.mul(M);
        uint d = P / M;
        assert(c > d);
        uint e = c - d;
        y = (e.mul(T.sub(x)) / A.mul(x).add(T)).add(d);
    }

    function getCurveTime(
        uint64  P, // target price
        uint8   M, // price factor
        uint    T,
        uint    y
        )
        public
        view
        returns (uint x)
    {
        uint c = P.mul(M);
        uint d = P / M;
        assert(c > d);
        uint e = c - d;
        x = T.mul(e)/ A.mul(y).add(e).sub(A.mul(d));
    }

}
