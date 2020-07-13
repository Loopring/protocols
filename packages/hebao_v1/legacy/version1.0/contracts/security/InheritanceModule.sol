// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.6.6;
pragma experimental ABIEncoderV2;

import "../../lib/MathUint.sol";

import "../../thirdparty/ERC1271.sol";

import "../../iface/Wallet.sol";

import "./SecurityModule.sol";


/// @title InheritanceModule
contract InheritanceModule is SecurityModule
{
    using SignatureUtil for bytes32;
    using AddressUtil   for address;

    uint public waitingPeriod;

    event Inherited(
        address indexed wallet,
        address indexed newOwner,
        uint            timestamp,
        bool            removedAsGuardian
    );

    constructor(
        ControllerImpl _controller,
        uint         _waitingPeriod
        )
        public
        SecurityModule(_controller)
    {
        require(_waitingPeriod > 0, "INVALID_DELAY");
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
        (address newOwner, uint lastActive) = controller.securityStore().inheritor(wallet);
        require(newOwner != address(0), "NULL_INHERITOR");

        require(
            lastActive > 0 && now >= lastActive + waitingPeriod,
            "NEED_TO_WAIT"
        );

        require(
            msg.sender == address(this) || msg.sender == newOwner,
            "NOT_ALLOWED"
        );

        SecurityStore securityStore = controller.securityStore();
        bool removedAsGuardian = securityStore.isGuardianOrPendingAddition(wallet, newOwner);

        if (removeAllGuardians) {
            securityStore.removeAllGuardians(wallet);
        } else if (removedAsGuardian) {
            securityStore.removeGuardian(wallet, newOwner, now);
        }

        securityStore.setInheritor(wallet, address(0));
        Wallet(wallet).setOwner(newOwner);
        unlockWallet(wallet, true /*force*/);

        emit Inherited(wallet, newOwner, now, removedAsGuardian);
    }

    function setInheritor(
        address wallet,
        address who
        )
        external
        nonReentrant
        onlyWhenWalletUnlocked(wallet)
        onlyFromMetaTxOrWalletOwner(wallet)
    {
        controller.securityStore().setInheritor(wallet, who);
    }

    function verifySigners(
        address   wallet,
        bytes4    method,
        bytes     memory /*data*/,
        address[] memory signers
        )
        internal
        view
        override
        returns (bool)
    {
        if (method == this.setInheritor.selector) {
            return isOnlySigner(Wallet(wallet).owner(), signers);
        } else if (method == this.inherit.selector) {
            (address newOwner, ) = controller.securityStore().inheritor(wallet);
            return isOnlySigner(newOwner, signers);
        } else {
            revert("INVALID_METHOD");
        }
    }
}
