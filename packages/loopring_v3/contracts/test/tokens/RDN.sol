// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../DummyToken.sol";

contract RDN is DummyToken {

    constructor() DummyToken(
        "RDN_TEST",
        "RDN",
        18,
        10 ** 27
    )
    {
    }

}
