// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;


/// @title Utility Functions for uint
/// @author Daniel Wang - <daniel@loopring.org>
library MathUint
{
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

    function toUint64(uint v)
        internal
        pure
        returns(uint64)
    {
        require((v << 192) >> 192 == v, "TOO_LARGE");
        return uint64(v);
    }

    function toUint128(uint v)
        internal
        pure
        returns(uint128)
    {
        require((v << 128) >> 128 == v, "TOO_LARGE");
        return uint128(v);
    }
}
