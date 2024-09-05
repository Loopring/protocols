// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/proxy/Proxy.sol";
import "./DelayedImplementationManager.sol";

/**
 * @title ForwardProxy
 * @author Kongliang Zhong - <kongliang@loopring.org>
 */
contract ForwardProxyV2 is Proxy {
    DelayedImplementationManagerV2 public immutable implManager;

    constructor(address _implManager) {
        require(_implManager != address(0), "ZERO_ADDRESS");
        implManager = DelayedImplementationManagerV2(_implManager);
    }

    function _implementation() internal view override returns (address) {
        return implManager.currImpl();
    }
}
