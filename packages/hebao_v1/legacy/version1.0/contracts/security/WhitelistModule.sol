// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.6.6;
pragma experimental ABIEncoderV2;

import "../../lib/MathUint.sol";

import "../../iface/Wallet.sol";

import "./SecurityModule.sol";

import "./GuardianUtils.sol";


/// @title WhitelistModule
/// @dev Manages whitelisted addresses.
contract WhitelistModule is SecurityModule
{
    using MathUint for uint;

    uint public delayPeriod;

    constructor(
        ControllerImpl _controller,
        uint         _delayPeriod
        )
        public
        SecurityModule(_controller)
    {
        require(_delayPeriod > 0, "INVALID_DELAY");
        delayPeriod = _delayPeriod;
    }

    function addToWhitelist(
        address wallet,
        address addr
        )
        external
        nonReentrant
        onlyWhenWalletUnlocked(wallet)
        onlyFromMetaTxOrWalletOwner(wallet)
    {
        controller.whitelistStore().addToWhitelist(wallet, addr, now.add(delayPeriod));
    }

    function addToWhitelistImmediately(
        address            wallet,
        address            addr
        )
        external
        nonReentrant
        onlyWhenWalletUnlocked(wallet)
        onlyFromMetaTx
    {
        controller.whitelistStore().addToWhitelist(wallet, addr, now);
    }

    function removeFromWhitelist(
        address wallet,
        address addr
        )
        external
        nonReentrant
        onlyWhenWalletUnlocked(wallet)
        onlyFromMetaTxOrWalletOwner(wallet)
    {
        controller.whitelistStore().removeFromWhitelist(wallet, addr);
    }

    function getWhitelist(address wallet)
        public
        view
        returns (
            address[] memory addresses,
            uint[]    memory effectiveTimes
        )
    {
        return controller.whitelistStore().whitelist(wallet);
    }

    function isWhitelisted(
        address wallet,
        address addr)
        public
        view
        returns (
            bool isWhitelistedAndEffective,
            uint effectiveTime
        )
    {
        return controller.whitelistStore().isWhitelisted(wallet, addr);
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
        if (method == this.addToWhitelist.selector ||
            method == this.removeFromWhitelist.selector) {
            return isOnlySigner(Wallet(wallet).owner(), signers);
        } else if (method == this.addToWhitelistImmediately.selector) {
            return GuardianUtils.requireMajority(
                controller.securityStore(),
                wallet,
                signers,
                GuardianUtils.SigRequirement.OwnerRequired
            );
        } else {
            revert("INVALID_METHOD");
        }
    }
}
