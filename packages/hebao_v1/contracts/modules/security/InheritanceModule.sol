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
        address         inheritor,
        uint32          waitingPeriod
    );

    function inheritor(address wallet)
        public
        view
        returns (address _inheritor, uint _effectiveTimestamp)
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
        SecurityStore ss = controllerCache.securityStore;
        (address _inheritor, uint _effectiveTimestamp) = ss.inheritor(wallet);

        require(_effectiveTimestamp > 0 && _effectiveTimestamp <= block.timestamp, "NEED_TO_WAIT");
        require(logicalSender() == _inheritor, "NOT_ALLOWED");

        ss.removeAllGuardians(wallet);
        ss.setInheritor(wallet, address(0), 0);
        _lockWallet(wallet, address(this), false);

        Wallet(wallet).setOwner(newOwner);

        emit Inherited(wallet, _inheritor, newOwner);
    }

    function setInheritor(
        address wallet,
        address _inheritor,
        uint32  _waitingPeriod
        )
        external
        txAwareHashNotAllowed()
        onlyFromWalletOrOwnerWhenUnlocked(wallet)
    {
        require(
            _inheritor == address(0) && _waitingPeriod == 0 ||
            _inheritor != address(0) &&
            _waitingPeriod >= TOUCH_GRACE_PERIOD * 2 &&
            _waitingPeriod <= 3650 days,
            "INVALID_INHERITOR_OR_WAITING_PERIOD"
        );

        controllerCache.securityStore.setInheritor(wallet, _inheritor, _waitingPeriod);
        emit InheritorChanged(wallet, _inheritor, _waitingPeriod);
    }
}
