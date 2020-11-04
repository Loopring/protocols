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
    ControllerImpl private immutable controller_;

    constructor(
        ControllerImpl _controller,
        address        _metaTxForwarder
        )
        SecurityModule(_controller, _metaTxForwarder)
        TransferModule()
    {
        controller_ = _controller;
    }
}

