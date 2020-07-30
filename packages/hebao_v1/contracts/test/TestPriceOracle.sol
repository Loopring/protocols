// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../iface/PriceOracle.sol";


/// @title PriceOracle
contract TestPriceOracle is PriceOracle
{
    // @dev Return's the token's value in ETH
    function tokenValue(address /*token*/, uint amount)
        external
        pure
        override
        returns (uint value)
    {
        value = amount * 10;
    }
}