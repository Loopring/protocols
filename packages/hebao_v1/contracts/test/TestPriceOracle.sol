// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.6.10;

import "../iface/PriceOracle.sol";


/// @title PriceOracle
contract TestPriceOracle is PriceOracle
{
    // @dev Return's the token's value in ETH
    function tokenValue(address /*token*/, uint amount)
        external
        view
        override
        returns (uint value)
    {
        value = amount * 10;
    }
}