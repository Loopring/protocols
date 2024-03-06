// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;

import "./WalletData.sol";
import "./ApprovalLib.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/// @title WhitelistLib
/// @dev This store maintains a wallet's whitelisted addresses.
library WhitelistLib {
    using WhitelistLib for Wallet;
    using SafeMath for uint;

    uint256 private constant WHITELIST_PENDING_PERIOD = 1 days;
    SigRequirement public constant SIG_REQUIREMENT =
        SigRequirement.MAJORITY_OWNER_REQUIRED;

    bytes32 private constant ADD_TO_WHITELIST_TYPEHASH =
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

    function encodeApprovalForAddToWhitelist(
        bytes memory data,
        bytes32 domainSeparator,
        uint256 validUntil
    ) external view returns (bytes32) {
        address addr = abi.decode(data, (address));
        bytes32 approvedHash = EIP712.hashPacked(
            domainSeparator,
            keccak256(
                abi.encode(
                    ADD_TO_WHITELIST_TYPEHASH,
                    address(this),
                    validUntil,
                    addr
                )
            )
        );
        return approvedHash;
    }
}
