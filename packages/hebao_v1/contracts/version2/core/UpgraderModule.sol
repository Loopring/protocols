pragma solidity ^0.6.6;
pragma experimental ABIEncoderV2;

import "../../thirdparty/OwnedUpgradabilityProxy.sol";
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
    address    public implementation;
    address[]  public modulesToRemove;
    address[]  public modulesToAdd;

    constructor(
        ControllerV2     _controller,
        address          _implementation,
        address[] memory _modulesToAdd,
        address[] memory _modulesToRemove
        )
        BaseModule(_controller)
        public
    {
        implementation = _implementation;
        modulesToAdd = _modulesToAdd;
        modulesToRemove = _modulesToRemove;
    }

    function activate()
        external
        override
    {
        address payable wallet = msg.sender;
        if (implementation != address(0) &&
            implementation != OwnedUpgradabilityProxy(wallet).implementation()) {
            bytes memory txData = abi.encodeWithSelector(
                OwnedUpgradabilityProxy(0).upgradeTo.selector,
                implementation
            );
            transactCall(wallet, wallet, 0, txData);
        }

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