// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../../core/iface/ILoopringV3.sol";
import "./DelayedOwner.sol";

interface IProxy {
    function transferProxyOwnership(address newOwner) external;
    function upgradeTo(address implementation) external;
    function upgradeToAndCall(
        address implementation,
        bytes memory data
    ) external payable;
}

/// @title  ProxyOwner
/// @author Break Xiong - <kl456123@outlook.com>
contract ProxyOwner is DelayedOwner {
    constructor(IProxy proxy) DelayedOwner(address(proxy), 3 days) {
        setFunctionDelay(proxy.transferProxyOwnership.selector, 7 days);
        setFunctionDelay(proxy.upgradeTo.selector, 7 days);
        setFunctionDelay(proxy.upgradeToAndCall.selector, 7 days);
    }
}
