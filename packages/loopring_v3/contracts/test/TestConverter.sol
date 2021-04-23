// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../converters/BaseConverter.sol";
import "./TestSwapper.sol";


/// @author Brecht Devos - <brecht@loopring.org>
contract TestConverter is BaseConverter
{
    TestSwapper public immutable swapContract;

    constructor(
        IExchangeV3 _exchange,
        TestSwapper _swapContract
        )
        BaseConverter(_exchange)
    {
        swapContract = _swapContract;
    }

    function convertToken(
        uint96          amountIn,
        uint96          minAmountOut,
        bytes  calldata /*customData*/
        )
        internal
        override
        returns (uint amountOut)
    {
        uint ethValue = (tokenIn == address(0)) ? amountIn : 0;
        amountOut = swapContract.swap{value: ethValue}(tokenIn, tokenOut, amountIn);
        require(amountOut >= minAmountOut, "INSUFFICIENT_OUT_AMOUNT");
    }

    function approveTokens()
        public
        override
    {
        super.approveTokens();
        if (tokenIn != address(0)) {
            ERC20(tokenIn).approve(address(swapContract), type(uint256).max);
        }
    }
}
