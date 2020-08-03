// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

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
