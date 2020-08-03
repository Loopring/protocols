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
    ControllerImpl private controller_;

    constructor(
        ControllerImpl _controller,
        address        _trustedForwarder,
        uint           _recoveryPendingPeriod,
        uint           _inheritWaitingPeriod,
        uint           _whitelistDelayPeriod
        )
        SecurityModule(_trustedForwarder)
        GuardianModule(_recoveryPendingPeriod)
        InheritanceModule(_inheritWaitingPeriod)
        WhitelistModule(_whitelistDelayPeriod)
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

    function bindableMethods()
        public
        pure
        override
        returns (bytes4[] memory methods)
    {
    }
}
