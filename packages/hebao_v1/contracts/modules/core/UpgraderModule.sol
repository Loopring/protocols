pragma solidity ^0.5.4;

import "../../iface/Controller.sol";

import "../../base/BaseModule.sol";


/// @title UpgraderModule
/// @dev This module removes obsolsted modules and add new modules, then
///      removes itself.
///
/// @author Daniel Wang - <daniel@loopring.org>
///
/// The design of this contract is inspired by Argent's contract codebase:
/// https://github.com/argentlabs/argent-contracts
contract UpgraderModule is BaseModule {
    address[] public modulesToRemove;
    address[] public modulesToAdd;

    constructor(
        address[] memory _modulesToRemove,
        address[] memory _modulesToAdd
        )
        public
    {
        modulesToRemove = _modulesToRemove;
        modulesToAdd = _modulesToAdd;
    }

    function activate()
        external
    {
        Wallet w = Wallet(msg.sender);
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

        emit Activated(msg.sender);

        w.removeModule(address(this));
    }


    function deactivate()
        external
    {
        emit Deactivated(msg.sender);
    }
}