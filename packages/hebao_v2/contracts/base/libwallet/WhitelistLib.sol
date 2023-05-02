// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;
pragma experimental ABIEncoderV2;

import "./WalletData.sol";
import "../../lib/MathUint.sol";
import "./ApprovalLib.sol";

/// @title WhitelistLib
/// @dev This store maintains a wallet's whitelisted addresses.
library WhitelistLib {
    using MathUint for uint;
    using WhitelistLib for Wallet;

    uint public constant WHITELIST_PENDING_PERIOD = 1 days;

    bytes32 public constant ADD_TO_WHITELIST_TYPEHASH =
        keccak256(
            "addToWhitelist(address wallet,uint256 validUntil,address addr)"
        );

    event Whitelisted(address addr, bool whitelisted, uint effectiveTime);

    function addToWhitelist(Wallet storage wallet, address addr) external {
        wallet._addToWhitelist(
            addr,
            block.timestamp.add(WHITELIST_PENDING_PERIOD)
        );
    }

    function addToWhitelistWA(Wallet storage wallet, address addr) external {
        wallet._addToWhitelist(addr, block.timestamp);
    }

    function removeFromWhitelist(Wallet storage wallet, address addr) external {
        wallet._removeFromWhitelist(addr);
    }

    function isAddressWhitelisted(
        Wallet storage wallet,
        address addr
    ) internal view returns (bool) {
        uint effectiveTime = wallet.whitelisted[addr];
        return effectiveTime > 0 && effectiveTime <= block.timestamp;
    }

    // --- Internal functions ---

    function _addToWhitelist(
        Wallet storage wallet,
        address addr,
        uint effectiveTime
    ) internal {
        require(wallet.whitelisted[addr] == 0, "ADDRESS_ALREADY_WHITELISTED");
        uint effective = effectiveTime >= block.timestamp
            ? effectiveTime
            : block.timestamp;
        wallet.whitelisted[addr] = effective;
        emit Whitelisted(addr, true, effective);
    }

    function _removeFromWhitelist(
        Wallet storage wallet,
        address addr
    ) internal {
        delete wallet.whitelisted[addr];
        emit Whitelisted(addr, false, 0);
    }

    function verifyApproval(
        Wallet storage wallet,
        bytes32 domainSeparator,
        bytes memory callData
    ) external returns (uint256) {
        (Approval memory approval, address addr) = abi.decode(
            callData,
            (Approval, address)
        );
        return
            ApprovalLib.verifyApproval(
                wallet,
                domainSeparator,
                SigRequirement.MAJORITY_OWNER_REQUIRED,
                approval,
                abi.encode(
                    ADD_TO_WHITELIST_TYPEHASH,
                    approval.wallet,
                    approval.validUntil,
                    addr
                )
            );
    }
}
