
// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "./AddressUtil.sol";
import "./ERC20.sol";
import "./ERC20SafeTransfer.sol";


/// @title TransferUtil
library TransferUtil
{
    using AddressUtil       for address;
    using ERC20SafeTransfer for address;

    function selfBalance(
        address token
        )
        internal
        view
        returns (uint amount)
    {
        amount = balanceOf(token, address(this));
    }

    function balanceOf(
        address token,
        address addr
        )
        internal
        view
        returns (uint amount)
    {
        if (token == address(0)) {
            amount = addr.balance;
        } else {
            amount = ERC20(token).balanceOf(addr);
        }
    }

    function transferIn(
        address token,
        address from,
        uint    amount
        )
        internal
    {
        if (token == address(0)) {
            require(msg.value == amount, "INVALID_ETH_VALUE");
        } else if (amount > 0) {
            token.safeTransferFromAndVerify(from, address(this), amount);
        }
    }

    function transferOut(
        address token,
        address to,
        uint    amount
        )
        internal
    {
        if (amount == 0) {
            return;
        }
        if (token == address(0)) {
            to.sendETHAndVerify(amount, gasleft());
        } else {
            token.safeTransferAndVerify(to, amount);
        }
    }

    function transferFromOut(
        address token,
        address from,
        address to,
        uint    amount
        )
        internal
    {
        if (amount == 0) {
            return;
        }
        if (token == address(0)) {
            to.sendETHAndVerify(amount, gasleft()); // ETH
        } else {
            token.safeTransferFromAndVerify(from, to, amount);  // ERC20 token
        }
    }
}
