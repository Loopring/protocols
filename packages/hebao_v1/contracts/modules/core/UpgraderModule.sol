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

    mapping (address => uint) positions;

    constructor(
        address          _implementation,
        uint             _version,
        address[] memory _modules
        )
        public
    {
        implementation = _implementation;
        version = _version;
        modules = _modules;

        for (uint i = 0; i < _modules.length; i++) {
            positions[_modules[i]] = i + 1;
        }
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

        for(uint i = 0; i < oldModules.length; i++) {
            if (positions[oldModules[i]] == 0) {
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
