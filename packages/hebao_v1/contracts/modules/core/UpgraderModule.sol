// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../base/BaseModule.sol";


/// @title UpgraderModule
/// @dev This module removes obsoleted modules and add new modules, then
///      removes itself.
///
/// @author Daniel Wang - <daniel@loopring.org>
///
/// The design of this contract is inspired by Argent's contract codebase:
/// https://github.com/argentlabs/argent-contracts
contract UpgraderModule is BaseModule {
    address[]  public modulesToRemove;
    address[]  public modulesToAdd;

    constructor(
        ControllerImpl   _controller,
        address[] memory _modulesToAdd,
        address[] memory _modulesToRemove
        )
        BaseModule(_controller)
    {
        modulesToAdd = _modulesToAdd;
        modulesToRemove = _modulesToRemove;
    }

    function activate()
        external
        override
    {
        address payable wallet = msg.sender;

        Wallet w = Wallet(wallet);
        for(uint i = 0; i < modulesToAdd.length; i++) {
            if (!w.hasModule(modulesToAdd[i])) {
                w.addModule(modulesToAdd[i]);
            }
        }
        for(uint i = 0; i < modulesToRemove.length; i++) {
            if (w.hasModule(modulesToRemove[i])) {
                w.removeModule(modulesToRemove[i]);
            }
        }

        emit Activated(wallet);
        w.removeModule(address(this));
    }
}
