// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../lib/AddressUtil.sol";
import "../lib/ERC20SafeTransfer.sol";
import "../lib/MathUint.sol";


/// @author Brecht Devos - <brecht@loopring.org>
contract TestSwapper
{
    using AddressUtil       for address payable;
    using ERC20SafeTransfer for address;
    using MathUint          for uint;

    uint    public immutable rate;
    bool    public immutable fail;

    constructor(
        uint    _rate,
        bool    _fail
        )
    {
        rate = _rate;
        fail = _fail;
    }

    function swap(
        address tokenIn,
        address tokenOut,
        uint    amountIn
        )
        external
        payable
        returns (uint amountOut)
    {
        require(!fail, "FAIL_ENABLED");

        if (tokenIn == address(0)) {
            require(msg.value == amountIn, "INVALID_ETH_DEPOSIT");
        } else {
            tokenIn.safeTransferFromAndVerify(msg.sender, address(this), amountIn);
        }

        amountOut = getAmountOut(tokenIn, tokenOut, amountIn);

        if (tokenOut == address(0)) {
            msg.sender.sendETHAndVerify(amountOut, gasleft());
        } else {
            tokenOut.safeTransferAndVerify(msg.sender, amountOut);
        }
    }

    function getAmountOut(
        address /*tokenIn*/,
        address /*tokenOut*/,
        uint amountIn
        )
        public
        view
        returns (uint amountOut)
    {
        amountOut = amountIn.mul(rate) / 1 ether;
    }

    receive()
        external
        payable
    {}
}