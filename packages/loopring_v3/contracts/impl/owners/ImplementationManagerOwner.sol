// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "./DelayedOwner.sol";
import "../../iface/IImplementationManager.sol";


/// @title ImplementationManagerOwner
/// @author Brecht Devos - <brecht@loopring.org>
contract ImplementationManagerOwner is DelayedOwner
{
    constructor(
        IImplementationManager implementationManager
        )
        DelayedOwner(address(implementationManager), 3 days)
    {
        setFunctionDelay(implementationManager.transferOwnership.selector, 7 days);
        setFunctionDelay(implementationManager.register.selector, 1 days);
        setFunctionDelay(implementationManager.setDefault.selector, 7 days);
        setFunctionDelay(implementationManager.enable.selector, 7 days);
        setFunctionDelay(implementationManager.disable.selector, 1 days);
    }
}
