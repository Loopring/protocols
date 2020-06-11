pragma solidity ^0.6.6;

import "../../iface/Controller.sol";

import "../../base/BaseModule.sol";

import "../../thirdparty/OwnedUpgradabilityProxy.sol";


/// @title UpgraderModule
/// @dev This module removes obsoleted modules and add new modules, then
///      removes itself.
///
/// @author Daniel Wang - <daniel@loopring.org>
///
/// The design of this contract is inspired by Argent's contract codebase:
/// https://github.com/argentlabs/argent-contracts
contract UpgraderModule is BaseModule {
    string     public label; // For example: "1.0.1"
    address    public implementation;
    address[]  public modulesToRemove;
    address[]  public modulesToAdd;
    // address[]  public modules;

    constructor(
        string    memory _label,
        address          _implementation,
        address[] memory _modulesToAdd,
        address[] memory _modulesToRemove
            )
        public
    {
        require(bytes(_label).length >= 5, "INVALID_VERSION_LABEL");
        label = _label;
        implementation = _implementation;
        modulesToAdd = _modulesToAdd;
        modulesToRemove = _modulesToRemove;
    }

    function activate()
        external
        override
    {
        Wallet w = Wallet(msg.sender);
        w.setLastUpgrader(address(this));

        if (implementation != address(0) &&
            implementation != OwnedUpgradabilityProxy(msg.sender).implementation()) {
            bytes memory txData = abi.encodeWithSelector(
                OwnedUpgradabilityProxy(0).upgradeTo.selector,
                implementation
            );
            transactCall(msg.sender, msg.sender, 0, txData);
        }

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

}
