// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TestKyberNetworkProxy {
    uint public expectedRate;

    constructor(uint _expectedRate) {
        expectedRate = _expectedRate;
    }

    function getExpectedRate(
        IERC20,
        IERC20,
        uint
    ) public view virtual returns (uint _expectedRate, uint _slippageRate) {
        _expectedRate = expectedRate;
        _slippageRate = 1;
    }
}
