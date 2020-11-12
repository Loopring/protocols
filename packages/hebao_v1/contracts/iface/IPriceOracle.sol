// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;


/// @title IPriceOracle
interface IPriceOracle
{
    // @dev Return's the token's value in ETH
    function tokenValue(address token, uint amount)
        external
        view
        returns (uint value);
}