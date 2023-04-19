// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;

import "../iface/PriceOracle.sol";


/// @title PriceOracle
contract TestPriceOracle is PriceOracle
{
    // @dev Return's the token's value in ETH
    function tokenValue(address /*token*/, uint amount)
        public
        pure
        override
        returns (uint value)
    {
        value = amount;
    }
}
