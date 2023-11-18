// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;

/// @title Utility Functions for uint
/// @author Daniel Wang - <daniel@loopring.org>
library MathUint {
    function mul(uint a, uint b) internal pure returns (uint c) {
        c = a * b;
        require(a == 0 || c / a == b, 'MUL_OVERFLOW');
    }

    function sub(uint a, uint b) internal pure returns (uint) {
        require(b <= a, 'SUB_UNDERFLOW');
        return a - b;
    }

    function add(uint a, uint b) internal pure returns (uint c) {
        c = a + b;
        require(c >= a, 'ADD_OVERFLOW');
    }
}
