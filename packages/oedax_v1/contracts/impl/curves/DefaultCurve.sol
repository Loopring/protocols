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

import "../../iface/ICurve.sol";

import "../../lib/MathUint.sol";
import "../../lib/NoDefaultFunc.sol";

/// @title An Implementation of ICurve.
/// @author Daniel Wang  - <daniel@loopring.org>

/// @dev A curve variation from `(1-x)/(1+a*x)`.
///
/// Let P0 and P1 be the min and max price, T be the duration,
/// let e = P1 - P0, and A be the curve parameter to control its shape:
/// then we have:
///   y = f(x) = (T-x)*e/(A*x+T)+P0
/// and
///   x = f(y) = (e-y+P0)*T/(A*(y-P0)+e), and if we let m = y-P0, then
///   x = f(y) = (e-m)*T/(A*m+e)

contract DefaultCurve is ICurve, NoDefaultFunc
{
    using MathUint for uint;
    using MathUint for uint64;

    uint64 A;  // 0 to 10 is a good number

    // -- Constructor --
    constructor(
        uint64        _A,
        string memory _name
        )
        public
    {
        A = _A; // allow it to be 0.
        name = name;
    }

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
       require(x >=0 && x <= T, "invalid x");
        uint e = P1 - P0;
        y = (T.sub(x).mul(e) / A.mul(x).add(T)).add(P0);
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
        require(y >= P0 && y <= P1, "invalid y");
        uint m = y - P0;
        uint e = P1 - P0;
        x = e.sub(m).mul(T) / A.mul(m).add(e);
    }

}
