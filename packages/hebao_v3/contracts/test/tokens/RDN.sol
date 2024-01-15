// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;

import "../DummyToken.sol";

contract RDN is DummyToken {
    constructor() DummyToken("RDN_TEST", "RDN", 18, 10 ** 27) {}
}
