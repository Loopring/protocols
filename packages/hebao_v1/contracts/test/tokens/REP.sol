// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.6.10;

import "../DummyToken.sol";

contract REP is DummyToken {

    constructor() DummyToken(
        "REP_TEST",
        "REP",
        18,
        10 ** 27
    ) public
    {
    }

}
