// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/proxy/Proxy.sol";
import "./DelayedImplementationManager.sol";

/**
 * @title ForwardProxy
 * @author Kongliang Zhong - <kongliang@loopring.org>
 */
contract ForwardProxy is Proxy {
    DelayedImplementationManager public immutable implManager;

    constructor(address _implManager) {
        require(_implManager != address(0), "ZERO_ADDRESS");
        implManager = DelayedImplementationManager(_implManager);
    }

    function _implementation() internal view override returns (address) {
        return implManager.currImpl();
    }
}
