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
    bool       public addModulesFirst;
    address    public implementation;
    address[]  public modules;

    constructor(
        string    memory _label,
        bool             _addModulesFirst,
        address          _implementation,
        address[] memory _modules
        )
        public
    {
        require(bytes(_label).length >= 5, "INVALID_VERSION_LABEL");
        require(_implementation != address(0) || _modules.length > 0, "INVALID_ARGS");
        label = _label;
        addModulesFirst = _addModulesFirst;
        implementation = _implementation;
        modules = _modules;
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

        if (modules.length > 0) {
            if (addModulesFirst) {
                addNewModules(w);
                removeOldModules(w);
            } else {
                removeOldModules(w);
                addNewModules(w);
            }
        }

        emit Activated(msg.sender);
        w.removeModule(address(this));
    }

    function removeOldModules(Wallet w)
        private
    {
        address[] memory oldModules = w.modules();
        bool found;
        for(uint i = 0; i < oldModules.length; i++) {
            found = false;
            for (uint j = 0; j < modules.length; j++) {
                if (modules[j] == oldModules[i]) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                w.removeModule(oldModules[i]);
            }
        }
    }

    function addNewModules(Wallet w)
        private
    {
        for(uint i = 0; i < modules.length; i++) {
            if (!w.hasModule(modules[i])) {
                w.addModule(modules[i]);
            }
        }
    }
}
