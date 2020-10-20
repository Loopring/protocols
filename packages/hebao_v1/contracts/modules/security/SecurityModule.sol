// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../base/MetaTxModule.sol";
import "./GuardianUtils.sol";
import "./SignedRequest.sol";


/// @title SecurityStore
///
/// @author Daniel Wang - <daniel@loopring.org>
///
/// The design of this contract is inspired by Argent's contract codebase:
/// https://github.com/argentlabs/argent-contracts
abstract contract SecurityModule is MetaTxModule
{
    using SignedRequest for ControllerImpl;

    // The minimal number of guardians for recovery and locking.
    uint constant public MIN_ACTIVE_GUARDIANS = 2;
    uint constant public MIN_TOUCH_INTERVAL   = 7 days;

    event WalletLock(
        address indexed wallet,
        uint            lock
    );

    constructor(address _trustedForwarder)
        MetaTxModule(_trustedForwarder)
    {
    }

    modifier onlyFromWalletOrOwnerWhenUnlocked(address wallet)
    {
        address payable _logicalSender = logicalSender();
        // If the wallet's signature verfication passes, the wallet must be unlocked.
        require(
            _logicalSender == wallet ||
            (_logicalSender == Wallet(wallet).owner() && !isWalletLocked(wallet)),
             "NOT_FROM_WALLET_OR_OWNER_OR_WALLET_LOCKED"
        );
        controllerCache.securityStore.touchLastActiveWhenRequired(wallet, MIN_TOUCH_INTERVAL);
        _;
    }

    modifier onlyFromGuardian(address wallet)
    {
        require(
            controller().securityStore().isGuardian(wallet, logicalSender()),
            "NOT_FROM_GUARDIAN"
        );
        _;
    }

    modifier onlyWhenWalletLocked(address wallet)
    {
        require(isWalletLocked(wallet), "NOT_LOCKED");
        _;
    }

    modifier onlyWhenWalletUnlocked(address wallet)
    {
        require(!isWalletLocked(wallet), "LOCKED");
        _;
    }

    modifier onlyWalletGuardian(address wallet, address guardian)
    {
        require(controller().securityStore().isGuardian(wallet, guardian), "NOT_GUARDIAN");
        _;
    }

    modifier notWalletGuardian(address wallet, address guardian)
    {
        require(!controller().securityStore().isGuardian(wallet, guardian), "IS_GUARDIAN");
        _;
    }

    modifier onlyHaveEnoughGuardians(address wallet)
    {
        require(
            controller().securityStore().numGuardians(wallet) >= MIN_ACTIVE_GUARDIANS,
            "NO_ENOUGH_ACTIVE_GUARDIANS"
        );
        _;
    }

    // ----- internal methods -----

    function quotaStore()
        internal
        view
        returns (address)
    {
        return address(controllerCache.quotaStore);
    }

    function lockWallet(address wallet)
        internal
    {
        lockWallet(wallet, controller().defaultLockPeriod());
    }

    function lockWallet(address wallet, uint _lockPeriod)
        internal
        onlyWhenWalletUnlocked(wallet)
    {
        // cannot lock the wallet twice by different modules.
        require(_lockPeriod > 0, "ZERO_VALUE");
        uint lock = block.timestamp + _lockPeriod;
        controller().securityStore().setLock(wallet, lock);
        emit WalletLock(wallet, lock);
    }

    function unlockWallet(address wallet, bool forceUnlock)
        internal
    {
        (uint _lock, address _lockedBy) = controller().securityStore().getLock(wallet);
        if (_lock > block.timestamp) {
            require(forceUnlock || _lockedBy == address(this), "UNABLE_TO_UNLOCK");
            controller().securityStore().setLock(wallet, 0);
        }
        emit WalletLock(wallet, 0);
    }

    function getWalletLock(address wallet)
        internal
        view
        returns (uint _lock, address _lockedBy)
    {
        return controller().securityStore().getLock(wallet);
    }

    function isWalletLocked(address wallet)
        internal
        view
        returns (bool)
    {
        (uint _lock,) = controller().securityStore().getLock(wallet);
        return _lock > block.timestamp;
    }

    function updateQuota(
        address wallet,
        address token,
        uint    amount
        )
        internal
    {
        QuotaStore _quotaStore = controllerCache.quotaStore;
        if (amount > 0 && _quotaStore != QuotaStore(0)) {
            uint value = (token == address(0)) ?
                amount :
                controllerCache.priceOracle.tokenValue(token, amount);

            if (value > 0) {
                _quotaStore.checkAndAddToSpent(wallet, value);
            }
        }
    }
}
