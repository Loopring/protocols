// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "./TransferModule.sol";


/// @title FinalTransferModule
/// @dev This module combines multiple small modules to
///      minimize the number of modules to reduce gas used
///      by wallet creation.
contract FinalTransferModule is TransferModule
{
    ControllerImpl private controller_;

    constructor(
        ControllerImpl _controller,
        address        _trustedForwarder,
        uint           _transferDelayPeriod
        )
        SecurityModule(_trustedForwarder)
        TransferModule(_transferDelayPeriod)
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

