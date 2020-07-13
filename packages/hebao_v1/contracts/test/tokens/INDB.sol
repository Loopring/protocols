// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.6.10;

import "../DummyToken.sol";

contract INDB is DummyToken {

    constructor() DummyToken(
        "INDIVISIBLE_B",
        "INDB",
        0,
        10 ** 27
    ) public
    {
    }

}
