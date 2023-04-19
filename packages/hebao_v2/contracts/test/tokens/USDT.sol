// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;

import "../DummyToken.sol";

contract USDT is DummyToken {

    constructor() DummyToken(
        "USDT_TEST",
        "USDT",
        6,
        10 ** 20
        )
    {
    }

}
