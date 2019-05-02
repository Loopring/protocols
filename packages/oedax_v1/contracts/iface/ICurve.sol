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

/// @title ICurve
/// @author Daniel Wang  - <daniel@loopring.org>
contract ICurve
{
    function getCurveValue(
        uint64  P, // target price
        uint64  S, // price scale
        uint8   M, // price factor
        uint    T,
        uint    time
        )
        public
        view
        returns (uint value);

    function getCurveTime(
        uint64  P, // target price
        uint64  S, // price scale
        uint8   M, // price factor
        uint    T,
        uint    value
        )
        public
        view
        returns (uint time);
}
