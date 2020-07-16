// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Project Ltd (Loopring Foundation).
pragma solidity ^0.6.10;

import "../DummyToken.sol";

contract RDN is DummyToken {

    constructor() DummyToken(
        "RDN_TEST",
        "RDN",
        18,
        10 ** 27
    ) public
    {
    }

}
