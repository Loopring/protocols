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
    address    public implementation;
    address[]  public modules;
    uint       public version;

    constructor(
        address          _implementation,
        uint             _version,
        address[] memory _modules
        )
        public
    {
        require(version > 0, "INVALID_VERSION_VALUE");
        require(modules.length > 0, "EMPTY_MODULES");
        implementation = _implementation;
        version = _version;
        modules = _modules;

    }

    function activate()
        external
        override
    {
        if (implementation != address(0) &&
            implementation != OwnedUpgradabilityProxy(msg.sender).implementation()) {
            bytes memory txData = abi.encodeWithSelector(
                OwnedUpgradabilityProxy(0).upgradeTo.selector,
                implementation
            );
            transactCall(msg.sender, msg.sender, 0, txData);
        }

        Wallet w = Wallet(msg.sender);
        w.updateVersion(version);

        address[] memory oldModules = w.modules();

        bool needRemove;
        for(uint i = 0; i < oldModules.length; i++) {
            needRemove = true;
            for (uint j = 0; j < modules.length; j ++) {
                if (modules[j] == oldModules[i]) {
                    needRemove = false;
                    break;
                }
            }
            if (needRemove) {
                w.removeModule(oldModules[i]);
            }
        }

        for(uint i = 0; i < modules.length; i++) {
            if (!w.hasModule(modules[i])) {
                w.addModule(modules[i]);
            }
        }

        emit Activated(msg.sender);
        w.removeModule(address(this));
    }

}
