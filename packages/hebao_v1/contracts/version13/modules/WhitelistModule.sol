// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../lib/MathUint.sol";
import "./base/SecurityModule.sol";


/// @title WhitelistModule
/// @dev Manages whitelisted addresses.
/// @author Daniel Wang - <daniel@loopring.org>
contract WhitelistModule is SecurityModule
{
    using MathUint      for uint;

    bytes32 public immutable WHITELIST_DOMAIN_SEPERATOR;

    uint public constant WHITELIST_PENDING_PERIOD = 1 days;

    bytes32 public constant ADD_TO_WHITELIST_TYPEHASH = keccak256(
        "addToWhitelist(address wallet,uint256 validUntil,address addr)"
    );
    bytes32 public constant REMOVE_FROM_WHITELIST_TYPEHASH = keccak256(
        "removeFromWhitelist(address wallet,uint256 validUntil,address addr)"
    );

    constructor(
        Controller _controller,
        address    _metaTxForwarder
        )
        SecurityModule(_controller, _metaTxForwarder)
    {
        WHITELIST_DOMAIN_SEPERATOR = EIP712.hash(
            EIP712.Domain("WhitelistModule", "1.3.0", address(this))
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
        whitelistStore.addToWhitelist(
            wallet,
            addr,
            block.timestamp.add(WHITELIST_PENDING_PERIOD)
        );
    }

    function addToWhitelistWA(
        SignedRequest.Request calldata request,
        address addr
        )
        external
    {
        SignedRequest.verifyRequest(
            hashStore,
            securityStore,
            WHITELIST_DOMAIN_SEPERATOR,
            txAwareHash(),
            GuardianUtils.SigRequirement.MAJORITY_OWNER_REQUIRED,
            request,
            abi.encode(
                ADD_TO_WHITELIST_TYPEHASH,
                request.wallet,
                request.validUntil,
                addr
            )
        );

        whitelistStore.addToWhitelist(
            request.wallet,
            addr,
            block.timestamp
        );
    }

    function removeFromWhitelist(
        address wallet,
        address addr
        )
        external
        txAwareHashNotAllowed()
        onlyFromWalletOrOwnerWhenUnlocked(wallet)
    {
        whitelistStore.removeFromWhitelist(wallet, addr);
    }

    function removeFromWhitelistWA(
        SignedRequest.Request calldata request,
        address addr
        )
        external
    {
        SignedRequest.verifyRequest(
            hashStore,
            securityStore,
            WHITELIST_DOMAIN_SEPERATOR,
            txAwareHash(),
            GuardianUtils.SigRequirement.MAJORITY_OWNER_REQUIRED,
            request,
            abi.encode(
                REMOVE_FROM_WHITELIST_TYPEHASH,
                request.wallet,
                request.validUntil,
                addr
            )
        );

        whitelistStore.removeFromWhitelist(request.wallet, addr);
    }

    function getWhitelist(address wallet)
        public
        view
        returns (
            address[] memory addresses,
            uint[]    memory effectiveTimes
        )
    {
        return whitelistStore.whitelist(wallet);
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
        return whitelistStore.isWhitelisted(wallet, addr);
    }
}
