// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../../core/iface/ILoopringV3.sol";
import "./DelayedOwner.sol";

/// @title  LoopringV3Owner
/// @author Break Xiong - <kl456123@outlook.com>
contract LoopringV3Owner is DelayedOwner {
    constructor(
        ILoopringV3 loopringV3
    ) DelayedOwner(address(loopringV3), 3 days) {
        setFunctionDelay(loopringV3.transferOwnership.selector, 7 days);
        setFunctionDelay(loopringV3.updateSettings.selector, 7 days);
        setFunctionDelay(loopringV3.updateProtocolFeeSettings.selector, 1 days);
    }
}
