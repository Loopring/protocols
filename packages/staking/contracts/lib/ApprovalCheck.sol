// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.0;

import "./ERC20.sol";
import "./BytesUtil.sol";
import "hardhat/console.sol";


/// @title ApprovalCheck
/// @author Kongliang Zhong - <kongliang@loopring.org>
/// @dev check ERC20 approve calls, only allowed when to address is whitelisted.
abstract contract ApprovalCheck {
    using BytesUtil for bytes;

    bytes4 public constant Erc20ApproveSelector = ERC20.approve.selector;
    mapping (address => bool) public allowedSpender;

    modifier isApprovalAllowed(bytes memory data) {
        if (data.toBytes4(0) == Erc20ApproveSelector) {
            address spender = data.toAddress(4 + 12);
            console.log(spender);
            require(allowedSpender[spender], "APPROVAL_SPENDER_NOW_ALLOWED");
        }

        _;
    }

    function _setApproveSpender(address target, bool allowed) internal {
        require(target != address(0), "ZERO_ADDRESS");
        allowedSpender[target] = allowed;
    }

}
