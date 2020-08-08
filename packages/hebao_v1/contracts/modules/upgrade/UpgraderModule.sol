// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../base/BaseWallet.sol";
import "../../stores/SecurityStore.sol";
import "../../thirdparty/proxy/OwnedUpgradeabilityProxy.sol";
import "../base/BaseModule.sol";
import "./SecurityStore_1_0_2.sol";


/// @title UpgraderModule
/// @dev This module removes obsoleted modules and add new modules, then
///      removes itself.
///
/// @author Daniel Wang - <daniel@loopring.org>
///
/// The design of this contract is inspired by Argent's contract codebase:
/// https://github.com/argentlabs/argent-contracts
contract UpgraderModule is BaseModule {
    ControllerImpl private controller_;

    address    public walletImplementation;
    address[]  public modulesToRemove;
    address[]  public modulesToAdd;

    SecurityStore_1_0_2 oldSecurityStore;
    SecurityStore       newSecurityStore;

    constructor(
        ControllerImpl   _controller,
        address          _walletImplementation,
        address[] memory _modulesToAdd,
        address[] memory _modulesToRemove,
        address          _oldSecurityStore,
        address          _newSecurityStore
        )
    {
        controller_ = _controller;
        walletImplementation = _walletImplementation;
        modulesToAdd = _modulesToAdd;
        modulesToRemove = _modulesToRemove;

        oldSecurityStore = SecurityStore_1_0_2(_oldSecurityStore);
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

    function bindableMethods()
        public
        pure
        override
        returns (bytes4[] memory methods)
    {
    }

    function upgradeWalletImplementation(address wallet)
        external
    {
        require(msg.sender == address(this), "PROHIBITED");

        if (walletImplementation != OwnedUpgradeabilityProxy(msg.sender).implementation()) {
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
        if (oldSecurityStore == SecurityStore_1_0_2(0) ||
            newSecurityStore == SecurityStore(0)) {
            return;
        }

        SecurityStore_1_0_2.Guardian[] memory guardians =
            oldSecurityStore.guardiansWithPending(wallet);

        for (uint i = 0; i < guardians.length; i++) {
            newSecurityStore.addGuardian(
                wallet,
                guardians[i].addr,
                guardians[i].group,
                guardians[i].validSince
            );
        }

        (address inheritor,) = oldSecurityStore.inheritor(wallet);
        if (inheritor != address(0)) {
            newSecurityStore.setInheritor(wallet, inheritor);
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

        migrateSecurityStore(wallet);

        emit Activated(wallet);
        w.removeModule(address(this));
    }
}