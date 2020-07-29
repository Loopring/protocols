// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

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
