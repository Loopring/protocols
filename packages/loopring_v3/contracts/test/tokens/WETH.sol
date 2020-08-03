// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

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
