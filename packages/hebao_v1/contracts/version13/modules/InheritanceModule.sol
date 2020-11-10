// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "./base/SecurityModule.sol";


/// @title InheritanceModule
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang - <daniel@loopring.org>
contract InheritanceModule is SecurityModule
{
    using AddressUtil   for address;
    using SignatureUtil for bytes32;

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

    constructor(
        Controller _controller,
        address    _metaTxForwarder
        )
        SecurityModule(_controller, _metaTxForwarder)
    {
    }

    function inheritor(address wallet)
        public
        view
        returns (address _inheritor, uint _effectiveTimestamp)
    {
        return securityStore.inheritor(wallet);
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
        SecurityStore ss = securityStore;
        (address _inheritor, uint _effectiveTimestamp) = ss.inheritor(wallet);

        require(_effectiveTimestamp != 0 && _inheritor != address(0), "NO_INHERITOR");
        require(_effectiveTimestamp <= block.timestamp, "TOO_EARLY");
        require(_inheritor == logicalSender(), "UNAUTHORIZED");

        ss.removeAllGuardians(wallet);
        ss.setInheritor(wallet, address(0), 0);
        _lockWallet(wallet, address(this), false);

        IWallet(wallet).setOwner(newOwner);

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

        securityStore.setInheritor(wallet, _inheritor, _waitingPeriod);
        emit InheritorChanged(wallet, _inheritor, _waitingPeriod);
    }
}
