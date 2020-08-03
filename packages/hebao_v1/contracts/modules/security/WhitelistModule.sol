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

    bytes32 public constant ADD_TO_WHITELIST_IMMEDIATELY_TYPEHASH = keccak256(
        "addToWhitelistImmediately(address wallet,uint256 validUntil,address addr)"
    );

    uint public whitelistDelayPeriod;

    constructor(uint _whitelistDelayPeriod)
    {
        require(_whitelistDelayPeriod > 0, "INVALID_DELAY");

        WHITELIST_DOMAIN_SEPERATOR = EIP712.hash(
            EIP712.Domain("WhitelistModule", "1.1.0", address(this))
        );
        whitelistDelayPeriod = _whitelistDelayPeriod;
    }

    function addToWhitelist(
        address wallet,
        address addr
        )
        external
        nonReentrant
        txAwareHashNotAllowed()
        onlyFromWalletOrOwnerWhenUnlocked(wallet)
    {
        controller().whitelistStore().addToWhitelist(wallet, addr, block.timestamp.add(whitelistDelayPeriod));
    }

    function addToWhitelistImmediately(
        SignedRequest.Request calldata request,
        address addr
        )
        external
        nonReentrant
        onlyWhenWalletUnlocked(request.wallet)
    {
        controller().verifyRequest(
            WHITELIST_DOMAIN_SEPERATOR,
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

        controller().whitelistStore().addToWhitelist(request.wallet, addr, block.timestamp);
    }

    function removeFromWhitelist(
        address wallet,
        address addr
        )
        external
        nonReentrant
        txAwareHashNotAllowed()
        onlyFromWalletOrOwnerWhenUnlocked(wallet)
    {
        controller().whitelistStore().removeFromWhitelist(wallet, addr);
    }

    function getWhitelist(address wallet)
        public
        view
        returns (
            address[] memory addresses,
            uint[]    memory effectiveTimes
        )
    {
        return controller().whitelistStore().whitelist(wallet);
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
        return controller().whitelistStore().isWhitelisted(wallet, addr);
    }
}
