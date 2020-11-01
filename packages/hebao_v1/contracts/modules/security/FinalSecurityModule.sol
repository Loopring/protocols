// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "./GuardianModule.sol";
import "./InheritanceModule.sol";
import "./WhitelistModule.sol";


/// @title FinalSecurityModule
/// @dev This module combines multiple small modules to
///      minimize the number of modules to reduce gas used
///      by wallet creation.
contract FinalSecurityModule is
    GuardianModule,
    InheritanceModule,
    WhitelistModule
{
    ControllerImpl private immutable controller_;

    constructor(
        ControllerImpl _controller,
        address        _metaTxForwarder
        )
        SecurityModule(_controller, _metaTxForwarder)
        GuardianModule()
        InheritanceModule()
        WhitelistModule()
    {
        controller_ = _controller;
    }

    function controller()
        internal
        view
        override
        returns(ControllerImpl)
    {
        return ControllerImpl(controller_);
    }
}
