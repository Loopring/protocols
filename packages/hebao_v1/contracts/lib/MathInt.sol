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
pragma solidity ^0.6.0;


/// @title Utility Functions for int
/// @author Daniel Wang - <daniel@loopring.org>
library MathInt
{
    function mul(
        int a,
        int b
        )
        internal
        pure
        returns (int c)
    {
        c = a * b;
        require(a == 0 || c / a == b, "MUL_OVERFLOW");
    }

    function sub(
        int a,
        int b
        )
        internal
        pure
        returns (int c)
    {

        c = a - b;
        require(a == b + c, "SUB_UNDERFLOW");
    }

    function add(
        int a,
        int b
        )
        internal
        pure
        returns (int c)
    {
        c = a + b;
        require(a == c - b, "ADD_OVERFLOW");
    }
}
