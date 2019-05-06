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
    /// @dev Calculate curve parameter C
    /// @param M Price factor
    /// @param T0 The shortest auction duration
    /// @param T  The longest auction duration
    function getParamC(
        uint M,
        uint T0,
        uint T
        )
        external
        pure
        returns (uint C);

    /// @dev Calculate the y value for the given x.
    /// @param C The curve parameter
    /// @param P0 The minimum y value
    /// @param P1 The maximum y value
    /// @param T  The maximum x value
    /// @param x The x
    /// @return y The y
    function xToY(
        uint C,
        uint P0, // min price
        uint P1, // max factor
        uint T,
        uint x
        )
        external
        pure
        returns (uint y);

    /// @dev Calculate the x value for the given y.
    /// @param C The curve parameter
    /// @param P0 The minimum y value
    /// @param P1 The maximum y value
    /// @param T  The maximum x value
    /// @param y The y
    /// @return x The x
    function yToX(
        uint C,
        uint P0, // min price
        uint P1, // max factor
        uint T,
        uint y
        )
        external
        pure
        returns (uint x);
}
