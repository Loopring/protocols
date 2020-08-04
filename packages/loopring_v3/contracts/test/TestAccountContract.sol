// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../core/iface/IExchangeV3.sol";

import "../lib/AddressUtil.sol";
import "../lib/MathUint.sol";


contract TestAccountContract {

    using AddressUtil       for address payable;
    using MathUint          for uint;

    IExchangeV3 exchange;

    uint[16] private dummyStorageVariables;

    modifier refund()
    {
        // Send surplus to msg.sender
        uint balanceBefore = address(this).balance.sub(msg.value);
        _;
        uint balanceAfter = address(this).balance;
        msg.sender.sendETHAndVerify(balanceAfter.sub(balanceBefore), gasleft());
    }

    constructor(
        address _exchangeAddress
        )
    {
        exchange = IExchangeV3(_exchangeAddress);
    }

    function withdraw(
        address token,
        uint96 amount,
        uint32 accountID
        )
        external
        payable
        refund
    {
        //exchange.withdraw{value: msg.value}(address(this), token, amount, accountID);
    }

    receive()
        external
        payable
    {
        // Some expensive operation
        for (uint i = 0; i < 16; i++) {
            dummyStorageVariables[i] = block.number;
        }
    }
}
