// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "./GuardianModule.sol";
import "./InheritanceModule.sol";
import "./WhitelistModule.sol";


/// @title PackedSecurityModule
/// @dev This module combines multiple small modules to
///      minimize the number of modules to reduce gas used
///      by wallet creation.
contract PackedSecurityModule is
    GuardianModule_,
    InheritanceModule_,
    WhitelistModule_
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
        GuardianModule_(_recoveryPendingPeriod)
        InheritanceModule_(_inheritWaitingPeriod)
        WhitelistModule_(_whitelistDelayPeriod)
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
