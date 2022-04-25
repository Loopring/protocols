// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.0;

import "./DummyERC20.sol";

contract FooToken is DummyERC20 {

    constructor () DummyERC20(
        "FOO Token",
        "FOO",
        18
        ) {

    }
}