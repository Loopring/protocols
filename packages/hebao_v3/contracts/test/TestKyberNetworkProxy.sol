// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;

import "../lib/ERC20.sol";

contract TestKyberNetworkProxy {
    uint public expectedRate;

    constructor(uint _expectedRate) {
        expectedRate = _expectedRate;
    }

    function getExpectedRate(
        ERC20 src,
        ERC20 dest,
        uint srcQty
    ) public view virtual returns (uint _expectedRate, uint _slippageRate) {
        _expectedRate = expectedRate;
        _slippageRate = 1;
    }
}
