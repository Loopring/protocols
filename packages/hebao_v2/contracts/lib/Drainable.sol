// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;

import "./AddressUtil.sol";
import "./ERC20.sol";
import "./ERC20SafeTransfer.sol";

/// @title Drainable
/// @author Brecht Devos - <brecht@loopring.org>
/// @dev Standard functionality to allow draining funds from a contract.
abstract contract Drainable {
    using AddressUtil for address;
    using ERC20SafeTransfer for address;

    event Drained(address to, address token, uint amount);

    function drain(address to, address token) external returns (uint amount) {
        require(canDrain(msg.sender, token), "UNAUTHORIZED");

        if (token == address(0)) {
            amount = address(this).balance;
            to.sendETHAndVerify(amount, gasleft()); // ETH
        } else {
            amount = ERC20(token).balanceOf(address(this));
            token.safeTransferAndVerify(to, amount); // ERC20 token
        }

        emit Drained(to, token, amount);
    }

    // Needs to return if the address is authorized to call drain.
    function canDrain(
        address drainer,
        address token
    ) public view virtual returns (bool);
}
