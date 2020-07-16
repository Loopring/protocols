// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.6.10;

import "../DummyToken.sol";

contract GTO is DummyToken {

    constructor() DummyToken(
        "GTO_TEST",
        "GTO",
        18,
        10 ** 27
    ) public
    {
    }

}
