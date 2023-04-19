// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;

import "../DummyToken.sol";

contract WETH is DummyToken {

    constructor() DummyToken(
        "WETH_TEST",
        "WETH",
        18,
        10 ** 27
        )
    {
    }

}
