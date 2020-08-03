// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../DummyToken.sol";

contract REP is DummyToken {

    constructor() DummyToken(
        "REP_TEST",
        "REP",
        18,
        10 ** 27
    )
    {
    }

}
