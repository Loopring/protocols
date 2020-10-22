// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "./SecurityModule.sol";


/// @title InheritanceModule
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang - <daniel@loopring.org>
abstract contract InheritanceModule is SecurityModule
{
    using AddressUtil   for address;
    using SignatureUtil for bytes32;

    uint public constant INHERIT_WAITING_PERIOD = 365 days + TOUCH_GRACE_PERIOD;

    event Inherited(
        address indexed wallet,
        address         inheritor,
        address         newOwner
    );

    event InheritorChanged(
        address indexed wallet,
        address         inheritor
    );

    function inheritor(address wallet)
        public
        view
        returns (address _inheritor, uint lastActive)
    {
        return controllerCache.securityStore.inheritor(wallet);
    }

    function inherit(
        address wallet,
        address newOwner
        )
        external
        txAwareHashNotAllowed()
        eligibleWalletOwner(newOwner)
        notWalletOwner(wallet, newOwner)
    {
        (address _inheritor, uint lastActive) = controllerCache.securityStore.inheritor(wallet);
        require(logicalSender() == _inheritor, "NOT_ALLOWED");

        require(lastActive > 0 && block.timestamp >= lastActive + INHERIT_WAITING_PERIOD, "NEED_TO_WAIT");

        controllerCache.securityStore.removeAllGuardians(wallet);
        controllerCache.securityStore.setInheritor(wallet, address(0));
        Wallet(wallet).setOwner(newOwner);

        // solium-disable-next-line
        unlockWallet(wallet, true /*force*/);

        emit Inherited(wallet, _inheritor, newOwner);
    }

    function setInheritor(
        address wallet,
        address _inheritor
        )
        external
        txAwareHashNotAllowed()
        onlyFromWalletOrOwnerWhenUnlocked(wallet)
    {
        (address existingInheritor,) = controllerCache.securityStore.inheritor(wallet);
        require(existingInheritor != _inheritor, "SAME_INHERITOR");

        controllerCache.securityStore.setInheritor(wallet, _inheritor);
        emit InheritorChanged(wallet, _inheritor);
    }
}
