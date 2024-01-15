// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
import "../base/VerifyingPaymaster.sol";
import "../iface/IEntryPoint.sol";
pragma solidity ^0.8.12;

contract EntrypointReentryAttacker {
    IEntryPoint public victim;

    constructor(address payable _victim) {
        victim = IEntryPoint(_victim);
    }

    bool public recusive = false;

    receive() external payable {
        if (recusive) {
            recusive = false;
            victim.withdrawStake(payable(this));
        }
    }

    function deposit() external payable {
        victim.addStake{value: msg.value}(10);
    }

    function unlockStake() external {
        victim.unlockStake();
    }

    function attack() external {
        recusive = true;
        victim.withdrawStake(payable(this));
    }
}
