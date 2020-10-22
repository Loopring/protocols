// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../lib/MathUint.sol";
import "./SecurityModule.sol";


/// @title WhitelistModule
/// @dev Manages whitelisted addresses.
/// @author Daniel Wang - <daniel@loopring.org>
abstract contract WhitelistModule is SecurityModule
{
    using MathUint      for uint;
    using SignedRequest for ControllerImpl;

    bytes32 public WHITELIST_DOMAIN_SEPERATOR;

    uint public constant WHITELIST_PENDING_PERIOD = 1 days;

    bytes32 public constant ADD_TO_WHITELIST_TYPEHASH = keccak256(
        "addToWhitelist(address wallet,uint256 validUntil,address addr)"
    );
    bytes32 public constant REMOVE_FROM_WHITELIST_TYPEHASH = keccak256(
        "removeFromWhitelist(address wallet,uint256 validUntil,address addr)"
    );

    constructor()
    {
        WHITELIST_DOMAIN_SEPERATOR = EIP712.hash(
            EIP712.Domain("WhitelistModule", "1.2.0", address(this))
        );
    }

    function addToWhitelist(
        address wallet,
        address addr
        )
        external
        txAwareHashNotAllowed()
        onlyFromWalletOrOwnerWhenUnlocked(wallet)
    {
        controllerCache.whitelistStore.addToWhitelist(wallet, addr, block.timestamp.add(WHITELIST_PENDING_PERIOD));
    }

    function addToWhitelistWA(
        SignedRequest.Request calldata request,
        address addr
        )
        external
    {
        controller().verifyRequest(
            WHITELIST_DOMAIN_SEPERATOR,
            txAwareHash(),
            GuardianUtils.SigRequirement.OwnerRequired,
            request,
            abi.encode(
                ADD_TO_WHITELIST_TYPEHASH,
                request.wallet,
                request.validUntil,
                addr
            )
        );

        controllerCache.whitelistStore.addToWhitelist(request.wallet, addr, block.timestamp);
    }

    function removeFromWhitelist(
        address wallet,
        address addr
        )
        external
        txAwareHashNotAllowed()
        onlyFromWalletOrOwnerWhenUnlocked(wallet)
    {
        controllerCache.whitelistStore.removeFromWhitelist(wallet, addr);
    }

    function removeFromWhitelistWA(
        SignedRequest.Request calldata request,
        address addr
        )
        external
    {
        controller().verifyRequest(
            WHITELIST_DOMAIN_SEPERATOR,
            txAwareHash(),
            GuardianUtils.SigRequirement.OwnerRequired,
            request,
            abi.encode(
                REMOVE_FROM_WHITELIST_TYPEHASH,
                request.wallet,
                request.validUntil,
                addr
            )
        );

        controllerCache.whitelistStore.removeFromWhitelist(request.wallet, addr);
    }

    function getWhitelist(address wallet)
        public
        view
        returns (
            address[] memory addresses,
            uint[]    memory effectiveTimes
        )
    {
        return controllerCache.whitelistStore.whitelist(wallet);
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
        return controllerCache.whitelistStore.isWhitelisted(wallet, addr);
    }
}
