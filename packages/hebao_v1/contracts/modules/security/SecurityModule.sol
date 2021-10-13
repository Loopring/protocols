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
abstract contract SecurityModule is MetaTxModule
{

    // A touch will be skipped if the last touch was within 30 days to save gas.
    uint public constant TOUCH_GRACE_PERIOD = 30 days;

    event WalletLocked(
        address indexed wallet,
        address         by,
        bool            locked
    );

    constructor(
        ControllerImpl _controller,
        address        _metaTxForwarder
        )
        MetaTxModule(_controller, _metaTxForwarder)
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
        securityStore.touchLastActiveWhenRequired(wallet, TOUCH_GRACE_PERIOD);
        _;
    }

    modifier onlyWalletGuardian(address wallet, address guardian)
    {
        require(securityStore.isGuardian(wallet, guardian, false), "NOT_GUARDIAN");
        _;
    }

    modifier notWalletGuardian(address wallet, address guardian)
    {
        require(!securityStore.isGuardian(wallet, guardian, false), "IS_GUARDIAN");
        _;
    }

    // ----- internal methods -----

    function _lockWallet(address wallet, address by, bool locked)
        internal
    {
        securityStore.setLock(wallet, locked);
        emit WalletLocked(wallet, by, locked);
    }

    function _isWalletLocked(address wallet)
        internal
        view
        returns (bool)
    {
        return securityStore.isLocked(wallet);
    }

    function _updateQuota(
        QuotaStore qs,
        address    wallet,
        address    token,
        uint       amount
        )
        internal
    {
        if (amount == 0) return;
        if (qs == QuotaStore(0)) return;

        qs.checkAndAddToSpent(
            wallet,
            token,
            amount,
            priceOracle
        );
    }
}
