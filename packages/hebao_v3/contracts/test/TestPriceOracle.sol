// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;

import "../iface/PriceOracle.sol";

/// @title PriceOracle
contract TestPriceOracle is PriceOracle {
    uint256 immutable price;

    constructor(uint256 _price) {
        price = _price;
    }

    // @dev Return's the token's value in ETH
    function tokenValue(
        address /*token*/,
        uint amount
    ) public view override returns (uint value) {
        value = amount * price;
    }
}
