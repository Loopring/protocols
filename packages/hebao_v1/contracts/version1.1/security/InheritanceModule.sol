// SPDX-License-Identifier: Apache-2.0
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
        address indexed inheritor,
        uint            timestamp,
        bool            removedAsGuardian
    );

    event InheritorChanged(
        address indexed wallet,
        address indexed inheritor
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
        returns (address who, uint lastActive)
    {
        return controller.securityStore().inheritor(wallet);
    }

    function inherit(
        address wallet,
        bool    removeAllGuardians
        )
        external
        nonReentrant
    {
        (address who, uint lastActive) = controller.securityStore().inheritor(wallet);
        require(logicalSender() == who, "NOT_ALLOWED");

        require(lastActive > 0 && now >= lastActive + waitingPeriod, "NEED_TO_WAIT");

        SecurityStore securityStore = controller.securityStore();
        bool removedAsGuardian = securityStore.isGuardianOrPendingAddition(wallet, who);

        if (removeAllGuardians) {
            securityStore.removeAllGuardians(wallet);
        } else if (removedAsGuardian) {
            securityStore.removeGuardian(wallet, who, now);
        }

        securityStore.setInheritor(wallet, address(0));
        Wallet(wallet).setOwner(who);
        // solium-disable-next-line
        unlockWallet(wallet, true /*force*/);

        emit Inherited(wallet, who, now, removedAsGuardian);
    }

    function setInheritor(
        address wallet,
        address who
        )
        external
        nonReentrant
        onlyFromWalletOrOwner(wallet)
    {
        (address existingInheritor,) = controller.securityStore().inheritor(wallet);
        require(existingInheritor != who, "SAME_INHERITOR");

        controller.securityStore().setInheritor(wallet, who);
        emit InheritorChanged(wallet, who);
    }
}
