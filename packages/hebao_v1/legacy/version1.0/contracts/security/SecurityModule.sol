// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.6.6;
pragma experimental ABIEncoderV2;

import "../security/GuardianUtils.sol";

import "../core/MetaTxModule.sol";


/// @title SecurityStore
///
/// @author Daniel Wang - <daniel@loopring.org>
///
/// The design of this contract is inspired by Argent's contract codebase:
/// https://github.com/argentlabs/argent-contracts
abstract contract SecurityModule is MetaTxModule
{
    // The minimal number of guardians for recovery and locking.
    uint constant public MIN_ACTIVE_GUARDIANS = 2;

    event WalletLock(
        address indexed wallet,
        uint            lock
    );

    constructor(ControllerImpl _controller)
        public
        MetaTxModule(_controller)
    {
    }

    // overriding
    modifier onlyFromWalletOwner(address wallet) override {
        require(
            msg.sender == Wallet(wallet).owner(),
            "NOT_FROM_WALLET_OWNER"
        );
        controller.securityStore().touchLastActive(wallet);
        _;
    }

    // overridding
    modifier onlyFromMetaTxOrWalletOwner(address wallet) override {
        require(
            msg.sender == Wallet(wallet).owner() ||
            msg.sender == address(this),
            "NOT_FROM_METATX_OR_WALLET_OWNER"
        );
        controller.securityStore().touchLastActive(wallet);
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
        require(controller.securityStore().isGuardian(wallet, guardian), "NOT_GUARDIAN");
        _;
    }

    modifier notWalletGuardian(address wallet, address guardian)
    {
        require(!controller.securityStore().isGuardian(wallet, guardian), "IS_GUARDIAN");
        _;
    }

    modifier onlyFromMetaTxOr(address guardian)
    {
        require(
            msg.sender == address(this) || msg.sender == guardian,
            "UNAUTHORIZED"
        );
        _;
    }

    modifier onlyHaveEnoughGuardians(address wallet)
    {
        require(
            controller.securityStore().numGuardians(wallet) >= MIN_ACTIVE_GUARDIANS,
            "NO_ENOUGH_ACTIVE_GUARDIANS"
        );
        _;
    }

    // ----- internal methods -----

    function quotaStore()
        internal
        view
        override
        returns (address)
    {
        return address(controller.quotaStore());
    }

    function lockWallet(address wallet)
        internal
    {
        lockWallet(wallet, controller.defaultLockPeriod());
    }

    function lockWallet(address wallet, uint _lockPeriod)
        internal
        onlyWhenWalletUnlocked(wallet)
    {
        // cannot lock the wallet twice by different modules.
        require(_lockPeriod > 0, "ZERO_VALUE");
        uint lock = now + _lockPeriod;
        controller.securityStore().setLock(wallet, lock);
        emit WalletLock(wallet, lock);
    }

    function unlockWallet(address wallet, bool forceUnlock)
        internal
    {
        (uint _lock, address _lockedBy) = controller.securityStore().getLock(wallet);
        if (_lock > now) {
            require(forceUnlock || _lockedBy == address(this), "UNABLE_TO_UNLOCK");
            controller.securityStore().setLock(wallet, 0);
            emit WalletLock(wallet, 0);
        }
    }

    function getWalletLock(address wallet)
        internal
        view
        returns (uint _lock, address _lockedBy)
    {
        return controller.securityStore().getLock(wallet);
    }

    function isWalletLocked(address wallet)
        internal
        view
        returns (bool)
    {
        (uint _lock,) = controller.securityStore().getLock(wallet);
        return _lock > now;
    }
}
