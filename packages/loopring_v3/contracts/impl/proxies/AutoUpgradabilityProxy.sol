// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../../iface/IExchangeProxy.sol";
import "../../iface/IImplementationManager.sol";
import "../../iface/IUniversalRegistry.sol";


/// @title AutoUpgradabilityProxy
/// @dev This proxy is designed to support automatic upgradability.
/// @author Daniel Wang  - <daniel@loopring.org>
contract AutoUpgradabilityProxy is IExchangeProxy
{
    constructor(address _registry) IExchangeProxy(_registry) {}

    function implementation()
        public
        override
        view
        returns (address)
    {
        IUniversalRegistry r = IUniversalRegistry(registry());
        (, address managerAddr) = r.getExchangeProtocol(address(this));
        return IImplementationManager(managerAddr).defaultImpl();
    }
}