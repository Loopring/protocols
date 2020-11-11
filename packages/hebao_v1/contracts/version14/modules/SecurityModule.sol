// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../base/WalletDataLayout.sol";
import "../data/SecurityData.sol";
import "./MetaTxAwareModule.sol";

// import "./GuardianUtils.sol";
// import "./SignedRequest.sol";


/// @title SecurityStore
///
/// @author Daniel Wang - <daniel@loopring.org>
abstract contract SecurityModule is MetaTxAwareModule
{
    using SecurityData for WalletDataLayout.State;

    // The minimal number of guardians for recovery and locking.
    uint public constant TOUCH_GRACE_PERIOD = 30 days;

    event WalletLocked(
        address indexed wallet,
        address         by,
        bool            locked
    );


    modifier onlyFromOwnerWhenUnlocked()
    {
        address payable _sender = msgSender();
        // If the wallet's signature verfication passes, the wallet must be unlocked.
        require(
            _sender == thisWallet().owner() && !_isWalletLocked(address(this)),
             "NOT_FROM_WALLET_OR_OWNER_OR_WALLET_LOCKED"
        );
        // securityStore.touchLastActiveWhenRequired(address(this), TOUCH_GRACE_PERIOD);
        _;
    }

    modifier onlyWalletGuardian(address guardian)
    {
        require(state.isGuardian(address(this), guardian, false), "NOT_GUARDIAN");
        _;
    }

    modifier notWalletGuardian(address guardian)
    {
        require(!state.isGuardian(address(this), guardian, false), "IS_GUARDIAN");
        _;
    }

    // ----- internal methods -----

    function _lockWallet(address wallet, address by, bool locked)
        internal
    {
        // securityStore.setLock(wallet, locked);
        emit WalletLocked(wallet, by, locked);
    }

    function _isWalletLocked(address wallet)
        internal
        view
        returns (bool)
    {
        // return securityStore.isLocked(wallet);
    }

    // function _updateQuota(
    //     QuotaStore qs,
    //     address    wallet,
    //     address    token,
    //     uint       amount
    //     )
    //     internal
    // {
    //     if (amount == 0) return;
    //     if (qs == QuotaStore(0)) return;

    //     qs.checkAndAddToSpent(
    //         wallet,
    //         token,
    //         amount,
    //         priceOracle
    //     );
    // }
}
