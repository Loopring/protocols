// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;

import "../DummyToken.sol";

contract INDB is DummyToken {

    constructor() DummyToken(
        "INDIVISIBLE_B",
        "INDB",
        0,
        10 ** 27
        )
    {
    }

}
