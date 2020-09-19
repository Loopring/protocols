// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;


/// @title Utility Functions for uint
/// @author Daniel Wang - <daniel@loopring.org>
library MathUint96
{
    function add(
        uint96 a,
        uint96 b
        )
        internal
        pure
        returns (uint96 c)
    {
        c = a + b;
        require(c >= a, "ADD_OVERFLOW");
    }

    function sub(
        uint96 a,
        uint96 b
        )
        internal
        pure
        returns (uint96 c)
    {
        require(b <= a, "SUB_UNDERFLOW");
        return a - b;
    }
}
