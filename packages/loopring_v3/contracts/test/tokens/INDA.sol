// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Project Ltd (Loopring Foundation).
pragma solidity ^0.6.10;


import "../DummyToken.sol";

contract INDA is DummyToken {

    constructor() DummyToken(
        "INDIVISIBLE_A",
        "INDA",
        0,
        10 ** 27
    ) public
    {
    }

}
