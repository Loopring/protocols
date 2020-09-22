// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;


/// @title Utility Functions for uint
/// @author Daniel Wang - <daniel@loopring.org>
library MathUint
{
    using MathUint for uint;

    function mul(
        uint a,
        uint b
        )
        internal
        pure
        returns (uint c)
    {
        c = a * b;
        require(a == 0 || c / a == b, "MUL_OVERFLOW");
    }

    function sub(
        uint a,
        uint b
        )
        internal
        pure
        returns (uint)
    {
        require(b <= a, "SUB_UNDERFLOW");
        return a - b;
    }

    function add(
        uint a,
        uint b
        )
        internal
        pure
        returns (uint c)
    {
        c = a + b;
        require(c >= a, "ADD_OVERFLOW");
    }

    function add64(
        uint64 a,
        uint64 b
        )
        internal
        pure
        returns (uint64 c)
    {
        c = a + b;
        require(c >= a, "ADD_OVERFLOW");
    }
}
