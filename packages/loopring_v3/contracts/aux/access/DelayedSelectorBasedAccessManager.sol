// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../../core/iface/IExchangeV3.sol";
import "../../lib/Claimable.sol";
import "../../thirdparty/BytesUtil.sol";
import "./DelayedTransaction.sol";

/// @title  SelectorBasedAccessManager
/// @author Daniel Wang - <daniel@loopring.org>
contract DelayedSelectorBasedAccessManager is DelayedTransaction, Claimable {
    using BytesUtil for bytes;

    event PermissionUpdate(
        address indexed user,
        bytes4 indexed selector,
        bool allowed
    );

    address public target;
    mapping(address => mapping(bytes4 => bool)) public permissions;

    modifier withAccess(bytes4 selector) {
        require(hasAccessTo(msg.sender, selector), "PERMISSION_DENIED");
        _;
    }

    constructor(
        address _target,
        uint _timeToLive
    ) DelayedTransaction(_timeToLive) {
        require(_target != address(0), "ZERO_ADDRESS");
        target = _target;
    }

    function grantAccess(
        address user,
        bytes4 selector,
        bool granted
    ) external onlyOwner {
        require(permissions[user][selector] != granted, "INVALID_VALUE");
        permissions[user][selector] = granted;
        emit PermissionUpdate(user, selector, granted);
    }

    receive() external payable {}

    fallback() external payable {
        transact(msg.data);
    }

    function transact(
        bytes memory data
    ) public payable withAccess(data.toBytes4(0)) {
        transactInternal(target, msg.value, data);
    }

    function hasAccessTo(
        address user,
        bytes4 selector
    ) public view returns (bool) {
        return user == owner || permissions[user][selector];
    }

    function isAuthorizedForTransactions(
        address sender
    ) internal view override returns (bool) {
        return hasAccessTo(sender, msg.data.toBytes4(0));
    }

    function setFunctionDelay(bytes4 functionSelector, uint delay) internal {
        setFunctionDelay(target, functionSelector, delay);
    }
}
