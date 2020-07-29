// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../DummyToken.sol";

contract LRC is DummyToken {

    constructor() DummyToken(
        "LRC_TEST",
        "LRC",
        18,
        10 ** 27
    )
    {
    }

}
