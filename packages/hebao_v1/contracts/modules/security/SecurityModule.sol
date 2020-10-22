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
    uint public constant TOUCH_GRACE_PERIOD = 30 days;

    event WalletLock(
        address indexed wallet,
        address         by,
        bool            locked
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
            (_logicalSender == Wallet(wallet).owner() && !_isWalletLocked(wallet)),
             "NOT_FROM_WALLET_OR_OWNER_OR_WALLET_LOCKED"
        );
        controllerCache.securityStore.touchLastActiveWhenRequired(wallet, TOUCH_GRACE_PERIOD);
        _;
    }

    modifier onlyFromGuardian(address wallet)
    {
        require(
            controllerCache.securityStore.isGuardian(wallet, logicalSender()),
            "NOT_FROM_GUARDIAN"
        );
        _;
    }

    modifier onlyWhenWalletLocked(address wallet)
    {
        require(_isWalletLocked(wallet), "NOT_LOCKED");
        _;
    }

    modifier onlyWhenWalletUnlocked(address wallet)
    {
        require(!_isWalletLocked(wallet), "LOCKED");
        _;
    }

    modifier onlyWalletGuardian(address wallet, address guardian)
    {
        require(controllerCache.securityStore.isGuardian(wallet, guardian), "NOT_GUARDIAN");
        _;
    }

    modifier notWalletGuardian(address wallet, address guardian)
    {
        require(!controllerCache.securityStore.isGuardian(wallet, guardian), "IS_GUARDIAN");
        _;
    }

    // ----- internal methods -----

    function _lockWallet(address wallet, address by, bool locked)
        internal
    {
        controllerCache.securityStore.setLock(wallet, locked);
        emit WalletLock(wallet, by, locked);
    }

    function _isWalletLocked(address wallet)
        internal
        view
        returns (bool)
    {
        return controllerCache.securityStore.isLocked(wallet);
    }

    function _updateQuota(
        address wallet,
        address token,
        uint    amount
        )
        internal
    {
        if (amount == 0) return;

        QuotaStore qs = controllerCache.quotaStore;
        if (qs == QuotaStore(0)) return;

        uint value = (token == address(0)) ?
            amount :
            controllerCache.priceOracle.tokenValue(token, amount);

        if (value == 0) return;

        qs.checkAndAddToSpent(wallet, value);
    }
}
