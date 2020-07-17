// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.6.10;

import "../DummyToken.sol";

contract USDT is DummyToken {

    constructor() DummyToken(
        "USDT_TEST",
        "USDT",
        6,
        10 ** 20
    ) public
    {
    }

}
