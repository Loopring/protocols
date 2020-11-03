// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../base/BaseWallet.sol";
import "../../stores/SecurityStore.sol";
import "../../thirdparty/proxy/OwnedUpgradeabilityProxy.sol";
import "../base/BaseModule.sol";
import "./SecurityStore_1_1_6.sol";


/// @title UpgraderModule
/// @dev This module removes obsoleted modules and add new modules, then
///      removes itself.
///
/// @author Daniel Wang - <daniel@loopring.org>

contract UpgraderModule is BaseModule {
    ControllerImpl private immutable controller_;

    address    public immutable walletImplementation;
    address[]  public modulesToRemove;
    address[]  public modulesToAdd;

    SecurityStore_1_1_6 immutable oldSecurityStore;
    SecurityStore       immutable newSecurityStore;

    constructor(
        ControllerImpl   _controller,
        address          _walletImplementation,
        address[] memory _modulesToAdd,
        address[] memory _modulesToRemove,
        address          _oldSecurityStore,
        address          _newSecurityStore
        )
        BaseModule(_controller)
    {
        controller_ = _controller;
        walletImplementation = _walletImplementation;
        modulesToAdd = _modulesToAdd;
        modulesToRemove = _modulesToRemove;

        oldSecurityStore = SecurityStore_1_1_6(_oldSecurityStore);
        newSecurityStore = SecurityStore(_newSecurityStore);
    }

    function controller()
        internal
        view
        override
        returns(ControllerImpl)
    {
        return ControllerImpl(controller_);
    }

    function upgradeWalletImplementation(address payable wallet)
        external
    {
        require(msg.sender == address(this), "NOT_ALLOWED");

        if (walletImplementation != OwnedUpgradeabilityProxy(wallet).implementation()) {
            bytes memory txData = abi.encodeWithSelector(
                OwnedUpgradeabilityProxy.upgradeTo.selector,
                walletImplementation
            );
            transactCall(wallet, wallet, 0, txData);
        }
    }

    function migrateSecurityStore(address wallet)
        internal
    {
        if (oldSecurityStore == SecurityStore_1_1_6(0) ||
            newSecurityStore == SecurityStore(0)) {
            return;
        }

        SecurityStore_1_1_6.Guardian[] memory guardians =
            oldSecurityStore.guardians(wallet);

        for (uint i = 0; i < guardians.length; i++) {
            newSecurityStore.addGuardian(
                wallet,
                guardians[i].addr,
                guardians[i].validSince,
                true
            );
        }

        (address inheritor,) = oldSecurityStore.inheritor(wallet);
        if (inheritor != address(0)) {
            newSecurityStore.setInheritor(wallet, inheritor, 365 days);
        }
    }

    function activate()
        external
        override
    {
        address payable wallet = msg.sender;

        if (walletImplementation != address(0)) {
            try UpgraderModule(address(this)).upgradeWalletImplementation(wallet) {} catch {}
        }

        BaseWallet w = BaseWallet(wallet);

        // Upgrade the controller if different
        if (w.controller() != controller_) {
            w.setController(controller_);
        }

        for(uint i = 0; i < modulesToRemove.length; i++) {
            if (w.hasModule(modulesToRemove[i])) {
                w.removeModule(modulesToRemove[i]);
            }
        }

        for(uint i = 0; i < modulesToAdd.length; i++) {
            if (!w.hasModule(modulesToAdd[i])) {
                w.addModule(modulesToAdd[i]);
            }
        }

        migrateSecurityStore(wallet);

        emit Activated(wallet);
        w.removeModule(address(this));
    }
}
