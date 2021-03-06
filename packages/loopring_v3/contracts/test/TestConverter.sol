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
        IExchangeV3      _exchange,
        address          _tokenIn,
        address          _tokenOut,
        string    memory _name,
        string    memory _symbol,
        uint8            _decimals,
        TestSwapper      _swapContract
        )
        BaseConverter(_exchange, _tokenIn, _tokenOut, _name, _symbol, _decimals)
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
    {
        uint ethValue = 0;
        if (tokenIn != address(0)) {
            ERC20(tokenIn).approve(address(swapContract), amountIn);
        } else {
            ethValue = amountIn;
        }
        uint amountOut = swapContract.swap{value: ethValue}(amountIn);
        require(amountOut >= minAmountOut, "INSUFFICIENT_OUT_AMOUNT");
    }
}
