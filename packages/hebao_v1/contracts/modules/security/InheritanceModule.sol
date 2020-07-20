// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.6.10;
pragma experimental ABIEncoderV2;

import "./SecurityModule.sol";


/// @title InheritanceModule
contract InheritanceModule is SecurityModule
{
    using AddressUtil   for address;
    using SignatureUtil for bytes32;

    uint public waitingPeriod;

    event Inherited(
        address indexed wallet,
        address         inheritor,
        address         newOwner
    );

    event InheritorChanged(
        address indexed wallet,
        address         inheritor
    );

    constructor(
        ControllerImpl _controller,
        address        _trustedForwarder,
        uint           _waitingPeriod
        )
        public
        SecurityModule(_controller, _trustedForwarder)
    {
        require(_waitingPeriod > 0, "INVALID_DELAY");

        DOMAIN_SEPERATOR = EIP712.hash(
            EIP712.Domain("InheritanceModule", "1.1.0", address(this))
        );
        waitingPeriod = _waitingPeriod;
    }

    function inheritor(address wallet)
        public
        view
        returns (address _inheritor, uint lastActive)
    {
        return controller.securityStore().inheritor(wallet);
    }

    function inherit(
        address wallet,
        address newOwner
        )
        external
        nonReentrant
        eligibleAsWalletOwner(newOwner)
        notWalletOwner(wallet, newOwner)
    {
        (address _inheritor, uint lastActive) = controller.securityStore().inheritor(wallet);
        require(logicalSender() == _inheritor, "NOT_ALLOWED");

        require(lastActive > 0 && now >= lastActive + waitingPeriod, "NEED_TO_WAIT");

        SecurityStore securityStore = controller.securityStore();

        securityStore.removeAllGuardians(wallet);

        securityStore.setInheritor(wallet, address(0));
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
        nonReentrant
        onlyFromWalletOrOwnerWhenUnlocked(wallet)
    {
        require(controller.walletRegistry().isWalletRegistered(_inheritor), "NOT_A_WALLET");
        (address existingInheritor,) = controller.securityStore().inheritor(wallet);
        require(existingInheritor != _inheritor, "SAME_INHERITOR");

        controller.securityStore().setInheritor(wallet, _inheritor);
        emit InheritorChanged(wallet, _inheritor);
    }
}
