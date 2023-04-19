// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;

import "../DummyToken.sol";

contract INDA is DummyToken {

    constructor() DummyToken(
        "INDIVISIBLE_A",
        "INDA",
        0,
        10 ** 27
        )
    {
    }

}
