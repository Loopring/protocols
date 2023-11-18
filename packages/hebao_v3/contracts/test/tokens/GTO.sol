// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;

import '../DummyToken.sol';

contract GTO is DummyToken {
    constructor() DummyToken('GTO_TEST', 'GTO', 18, 10 ** 27) {}
}
