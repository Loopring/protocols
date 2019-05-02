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


    // Let P0 and P1 be the min and max prixe, and e = P1 - P0,
    // and  use A as the curve parameter to control
    // it shape, then we use this curve:
    // ```y = f(x) = (e(T-x)/(A*x+T))+P0```
    // and
    // ```x = f(y) = T*e/(A*y+e-A*P0))```

    uint A = 3; // If A is 0, then the curve is a stright line.

    function getCurveValue(
        uint64  P0, // min price
        uint64  P1, // max factor
        uint    T,
        uint    x
        )
        public
        view
        returns (uint y)
    {
        uint e = P1 - P0;
        y = (e.mul(T.sub(x)) / A.mul(x).add(T)).add(P0);
    }

    function getCurveTime(
        uint64  P0, // min price
        uint64  P1, // max factor
        uint    T,
        uint    y
        )
        public
        view
        returns (uint x)
    {
        uint e = P1 - P0;
        x = T.mul(e) / A.mul(y).add(e).sub(A.mul(P0));
    }

}
