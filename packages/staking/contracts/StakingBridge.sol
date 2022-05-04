// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "./lib/OwnerManagable.sol";
import "./lib/BytesUtil.sol";
import "./lib/Drainable.sol";

contract StakingBridge is OwnerManagable, Drainable {
    using BytesUtil for bytes;

    mapping(address => mapping(bytes4 => bool)) public authorized;

    event CallSucceeded(uint callId, address target, bytes4 method);
    event CallReverted(uint callId, address target, bytes4 method);

    modifier withAccess(address target, bytes4 selector) {
        require(authorized[target][selector], "UNAUTHORIZED_CALLE");
        _;
    }

    receive() external payable { }

    function authorizeCall(address target, bytes4 selector)
        external
        onlyOwner
    {
        authorized[target][selector] = true;
    }

    function unauthorizeCall(address target, bytes4 selector)
        external
        onlyOwner
    {
        delete authorized[target][selector];
    }

    function call(uint callId, address target, bytes calldata data)
        payable
        external
        withAccess(target, data.toBytes4(0))
        onlyManager(msg.sender)
    {
        (bool success, /*bytes memory returnData*/) = target
            .call{value: msg.value}(data);

        if (success) {
	    emit CallSucceeded(callId, target, data.toBytes4(0));
        } else {
	    emit CallReverted(callId, target, data.toBytes4(0));
	}

    }

    function canDrain(address drainer, address /*token*/)
        public
        view
        override
        returns (bool)
    {
        return drainer == owner;
    }

}
