// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../lib/MathUint.sol";
import "../data/WhitelistData.sol";
import "./SecurityModule.sol";


/// @title WhitelistModule
/// @dev Manages whitelisted addresses.
/// @author Daniel Wang - <daniel@loopring.org>
contract WhitelistModule is SecurityModule
{
    using WhitelistData for WalletDataLayout.State;
    using MathUint for uint;

    uint    public constant WHITELIST_PENDING_PERIOD       = 1 days;
    bytes32 public constant ADD_TO_WHITELIST_TYPEHASH      = keccak256("addToWhitelist(uint256 validUntil,address addr)");
    bytes32 public constant REMOVE_FROM_WHITELIST_TYPEHASH = keccak256("removeFromWhitelist(uint256 validUntil,address addr)");

    function bindableMethods()
        public
        override
        pure
        returns (bytes4[] memory methods)
    {
        methods = new bytes4[](6);
        methods[0] = this.whitelist.selector;
        methods[1] = this.isWhitelisted.selector;
        methods[2] = this.addToWhitelist.selector;
        methods[3] = this.addToWhitelistWA.selector;
        methods[4] = this.removeFromWhitelist.selector;
        methods[5] = this.removeFromWhitelistWA.selector;
    }

   function whitelist()
        public
        view
        returns (
            address[] memory addresses,
            uint[]    memory effectiveTimes
        )
    {
        return state.whitelist();
    }

    function isWhitelisted(address addr)
        public
        view
        returns (
            bool isWhitelistedAndEffective,
            uint effectiveTime
        )
    {
        return state.isWhitelisted(addr);
    }

    function addToWhitelist(address addr)
        external
        txAwareHashNotAllowed
        onlyFromWalletOrOwnerWhenUnlocked
    {
        state.addToWhitelist(addr, block.timestamp.add(WHITELIST_PENDING_PERIOD));
    }

    function addToWhitelistWA(
        SignedRequest.Request calldata request,
        address addr
        )
        external
    {
        _verifyRequest(
            GuardianUtils.SigRequirement.MAJORITY_OWNER_REQUIRED,
            request,
            abi.encode(
                ADD_TO_WHITELIST_TYPEHASH,
                request.validUntil,
                addr
            )
        );

        state.addToWhitelist(addr, block.timestamp);
    }

    function removeFromWhitelist(address addr)
        external
        txAwareHashNotAllowed
        onlyFromWalletOrOwnerWhenUnlocked
    {
        state.removeFromWhitelist(addr);
    }

    function removeFromWhitelistWA(
        SignedRequest.Request calldata request,
        address addr
        )
        external
    {
        _verifyRequest(
            GuardianUtils.SigRequirement.MAJORITY_OWNER_REQUIRED,
            request,
            abi.encode(
                REMOVE_FROM_WHITELIST_TYPEHASH,
                request.validUntil,
                addr
            )
        );

        state.removeFromWhitelist(addr);
    }
}
