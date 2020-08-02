// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "./ERC1271Module.sol";
import "./ForwarderModule.sol";

contract PackedCoreModule is
    ERC1271Module_,
    ForwarderModule_
{
    ControllerImpl private controller_;

    constructor(ControllerImpl _controller)
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
        return bindableMethods_();
    }
}
