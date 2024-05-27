// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;

import "./WalletData.sol";
import "./GuardianLib.sol";
import "./LockLib.sol";
import "./Utils.sol";

/// @title InheritanceLib
/// @author Brecht Devos - <brecht@loopring.org>
library InheritanceLib {
    using GuardianLib for Wallet;
    using InheritanceLib for Wallet;
    using LockLib for Wallet;
    using Utils for address;

    // The minimal number of guardians for recovery and locking.
    uint private constant TOUCH_GRACE_PERIOD = 30 days;

    event Inherited(address inheritor, address newOwner);

    event InheritorChanged(address inheritor, uint32 waitingPeriod);

    function touchLastActiveWhenRequired(Wallet storage wallet) internal {
        if (
            wallet.inheritor != address(0) &&
            block.timestamp > wallet.lastActive + TOUCH_GRACE_PERIOD
        ) {
            wallet.lastActive = uint64(block.timestamp);
        }
    }

    function setInheritor(
        Wallet storage wallet,
        address inheritor,
        uint32 waitingPeriod
    ) internal {
        if (inheritor == address(0)) {
            require(waitingPeriod == 0, "INVALID_WAITING_PERIOD");
        } else {
            require(
                waitingPeriod >= TOUCH_GRACE_PERIOD,
                "INVALID_WAITING_PERIOD"
            );
        }

        require(inheritor != address(this), "INVALID_ARGS");
        wallet.inheritor = inheritor;
        wallet.inheritWaitingPeriod = waitingPeriod;
        wallet.lastActive = uint64(block.timestamp);

        emit InheritorChanged(inheritor, waitingPeriod);
    }

    function inherit(
        Wallet storage wallet,
        address newOwner,
        address[] calldata newGuardians
    ) external {
        require(wallet.owner != newOwner, "IS_WALLET_OWNER");
        require(newOwner.isValidWalletOwner(), "INVALID_NEW_WALLET_OWNER");
        require(
            uint(wallet.lastActive) + uint(wallet.inheritWaitingPeriod) <
                block.timestamp,
            "TOO_EARLY"
        );

        if (newGuardians.length > 0) {
            for (uint i = 0; i < newGuardians.length; i++) {
                require(
                    newGuardians[i] != newOwner,
                    "INVALID_NEW_WALLET_GUARDIAN"
                );
            }
            wallet.removeAllGuardians();
            wallet.addGuardiansImmediately(newGuardians);
        } else {
            if (wallet.isGuardian(newOwner, true)) {
                wallet.deleteGuardian(newOwner, block.timestamp, true);
            }
            wallet.cancelPendingGuardians();
        }
        wallet.setInheritor(address(0), 0);
        wallet.setLock(address(this), false);

        wallet.owner = newOwner;

        emit Inherited(wallet.inheritor, newOwner);
    }
}
