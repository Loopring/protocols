// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.6.10;
pragma experimental ABIEncoderV2;

import "./SecurityModule.sol";

/// @title WhitelistModule
/// @dev Manages whitelisted addresses.
contract WhitelistModule is SecurityModule
{
    bytes32 public constant ADD_TO_WHITELIST_IMMEDIATELY_TYPEHASH = keccak256(
        "addToWhitelistImmediately(address wallet,uint256 validUntil,address addr)"
    );

    uint public delayPeriod;

    constructor(
        ControllerImpl _controller,
        address        _trustedForwarder,
        uint           _delayPeriod
        )
        public
        SecurityModule(_controller, _trustedForwarder)
    {
        require(_delayPeriod > 0, "INVALID_DELAY");

        DOMAIN_SEPERATOR = EIP712.hash(
            EIP712.Domain("WhitelistModule", "1.1.0", address(this))
        );
        delayPeriod = _delayPeriod;
    }

    function addToWhitelist(
        address wallet,
        address addr
        )
        external
        nonReentrant
        onlyFromWalletOrOwnerWhenUnlocked(wallet)
    {
        controller.whitelistStore().addToWhitelist(wallet, addr, now.add(delayPeriod));
    }

    function addToWhitelistImmediately(
        SignedRequest.Request calldata request,
        address addr
        )
        external
        nonReentrant
        onlyWhenWalletUnlocked(request.wallet)
    {
        controller.verifyRequest(
            DOMAIN_SEPERATOR,
            txAwareHash(),
            GuardianUtils.SigRequirement.OwnerRequired,
            request,
            abi.encode(
                ADD_TO_WHITELIST_IMMEDIATELY_TYPEHASH,
                request.wallet,
                request.validUntil,
                addr
            )
        );

        controller.whitelistStore().addToWhitelist(request.wallet, addr, now);
    }

    function removeFromWhitelist(
        address wallet,
        address addr
        )
        external
        nonReentrant
        onlyFromWalletOrOwnerWhenUnlocked(wallet)
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
}
