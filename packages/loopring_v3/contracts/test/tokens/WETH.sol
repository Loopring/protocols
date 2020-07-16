// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Project Ltd (Loopring Foundation).
pragma solidity ^0.6.10;

import "../DummyToken.sol";

contract WETH is DummyToken {

    constructor() DummyToken(
        "WETH_TEST",
        "WETH",
        18,
        10 ** 27
    ) public
    {
    }

}
