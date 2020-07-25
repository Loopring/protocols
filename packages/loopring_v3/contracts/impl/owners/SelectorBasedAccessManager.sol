// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.6.10;

import "../../lib/Claimable.sol";

import "../../thirdparty/BytesUtil.sol";

import "../../iface/IExchangeV3.sol";

/// @title  SelectorBasedAccessManager
/// @author Daniel Wang - <daniel@loopring.org>
contract SelectorBasedAccessManager is Claimable
{
    using BytesUtil for bytes;

    event PermissionUpdate(
        address indexed user,
        bytes4  indexed selector,
        bool            allowed
    );

    address public target;
    mapping(address => mapping(bytes4 => bool)) public permissions;

    constructor(address _target)
        public
    {
        require(_target != address(0), "ZERO_ADDRESS");
        target = _target;
    }

    function setPermission(
        address user,
        bytes4  selector,
        bool    allowed
        )
        external
        onlyOwner
    {
        require(permissions[user][selector] != allowed, "INVALID_VALUE");
        permissions[user][selector] = allowed;
        emit PermissionUpdate(user, selector, allowed);
    }

    receive() payable external {}

    fallback() payable external
    {
        require(
            hasPermission(msg.sender, msg.data.toBytes4(0)),
            "PERMISSION_DENIED"
        );

        (bool success, bytes memory returnData) = target
            .call{value: msg.value}(msg.data);

        if (!success) {
            assembly { revert(add(returnData, 32), mload(returnData)) }
        }
    }

    function hasPermission(address user, bytes4 selector)
        public
        view
        returns (bool)
    {
        return user == owner || permissions[user][selector];
    }
}
