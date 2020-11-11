// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../lib/EIP712.sol";
import "../../lib/MathUint.sol";
import "../data/GuardianData.sol";
import "../data/InheritanceData.sol";
import "../data/SecurityData.sol";
import "./SecurityModule.sol";



/// @title InheritanceModule
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang - <daniel@loopring.org>
contract InheritanceModule is SecurityModule
{
    using GuardianData    for WalletDataLayout.State;
    using InheritanceData for WalletDataLayout.State;
    using SecurityData    for WalletDataLayout.State;
    using SignatureUtil   for bytes32;
    using AddressUtil     for address;

    event Inherited       (address inheritor, address newOwner);
    event InheritorChanged(address inheritor, uint32 waitingPeriod);

    function bindableMethods()
        public
        override
        pure
        returns (bytes4[] memory methods)
    {
        methods = new bytes4[](3);
        methods[0] = this.inheritor.selector;
        methods[1] = this.setInheritor.selector;
        methods[2] = this.inherit.selector;
    }

    function inheritor()
        public
        view
        returns (address _inheritor, uint _effectiveTimestamp)
    {
        return state.inheritor();
    }

    function setInheritor(
        address _inheritor,
        uint32  _waitingPeriod
        )
        public
        txAwareHashNotAllowed
        onlyFromWalletOrOwnerWhenUnlocked
    {
        require(
            _inheritor == address(0) && _waitingPeriod == 0 ||
            _inheritor != address(0) &&
            _waitingPeriod >= TOUCH_GRACE_PERIOD * 2 &&
            _waitingPeriod <= 3650 days,
            "INVALID_INHERITOR_OR_WAITING_PERIOD"
        );

        state.setInheritor(_inheritor, _waitingPeriod);
        emit InheritorChanged(_inheritor, _waitingPeriod);
    }

    function inherit(address newOwner)
        public
        txAwareHashNotAllowed
        eligibleWalletOwner(newOwner)
        notWalletOwner(newOwner)
    {
        (address _inheritor, uint _effectiveTimestamp) = state.inheritor();

        require(_effectiveTimestamp != 0 && _inheritor != address(0), "NO_INHERITOR");
        require(_effectiveTimestamp <= block.timestamp, "TOO_EARLY");
        require(_inheritor == msgSender(), "UNAUTHORIZED");

        state.removeAllGuardians();
        state.setInheritor(address(0), 0);
        state.setLock(false);
        thisWallet().setOwner(newOwner);

        emit Inherited(_inheritor, newOwner);
    }
}
