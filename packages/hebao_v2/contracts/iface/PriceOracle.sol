// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;


/// @title PriceOracle
interface PriceOracle
{
    // @dev Return's the token's value in ETH
    function tokenValue(address token, uint amount)
        external
        view
        returns (uint value);
}
