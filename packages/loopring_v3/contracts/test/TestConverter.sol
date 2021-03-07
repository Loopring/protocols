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

    function convert(
        uint96          amountIn,
        uint96          minAmountOut,
        bytes  calldata /*customData*/
        )
        internal
        override
        returns (uint amountOut)
    {
        address _tokenIn = tokenIn;

        uint ethValue = 0;
        if (_tokenIn != address(0)) {
            ERC20(_tokenIn).approve(address(swapContract), amountIn);
        } else {
            ethValue = amountIn;
        }
        amountOut = swapContract.swap{value: ethValue}(amountIn);
        require(amountOut >= minAmountOut, "INSUFFICIENT_OUT_AMOUNT");
    }
}
