// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../../core/iface/IExchangeV3.sol";
import "../../lib/Claimable.sol";
import "../../thirdparty/BytesUtil.sol";


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

    address public immutable target;
    mapping(address => mapping(bytes4 => bool)) public permissions;

    modifier withAccess(bytes4 selector)
    {
        require(hasAccessTo(msg.sender, selector), "PERMISSION_DENIED");
        _;
    }

    constructor(address _target)
    {
        require(_target != address(0), "ZERO_ADDRESS");
        target = _target;
    }

    function grantAccess(
        address user,
        bytes4  selector,
        bool    granted
        )
        external
        onlyOwner
    {
        require(permissions[user][selector] != granted, "INVALID_VALUE");
        permissions[user][selector] = granted;
        emit PermissionUpdate(user, selector, granted);
    }

    receive() payable external {}

    fallback()
        payable
        external
    {
        transact(msg.data);
    }

    function transact(bytes memory data)
        payable
        public
        withAccess(data.toBytes4(0))
    {
        (bool success, bytes memory returnData) = target
            .call{value: msg.value}(data);

        if (!success) {
            assembly { revert(add(returnData, 32), mload(returnData)) }
        }
    }

    function hasAccessTo(address user, bytes4 selector)
        public
        view
        returns (bool)
    {
        return user == owner || permissions[user][selector];
    }
}
