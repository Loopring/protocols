// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "./ERC1271Module.sol";
import "./ForwarderModule.sol";


/// @title FinalCoreModule
/// @dev This module combines multiple small modules to
///      minimize the number of modules to reduce gas used
///      by wallet creation.
contract FinalCoreModule is
    ERC1271Module,
    ForwarderModule
{
    ControllerImpl private immutable controller_;

    constructor(ControllerImpl _controller)
        ForwarderModule(_controller)
    {
        controller_ = _controller;
    }

    function bindableMethods()
        public
        pure
        override
        returns (bytes4[] memory)
    {
        return bindableMethodsForERC1271();
    }
}
