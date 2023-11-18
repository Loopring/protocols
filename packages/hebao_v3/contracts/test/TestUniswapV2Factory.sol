// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;

/// @title PriceOracle
contract TestUniswapV2Factory {
    mapping(address => mapping(address => address)) public getPair;

    function addPair(
        address tokenA,
        address tokenB,
        address pair
    ) external {
        getPair[tokenA][tokenB] = pair;
        getPair[tokenB][tokenA] = pair;
    }
}
