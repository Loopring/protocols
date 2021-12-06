// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../iface/PriceOracle.sol";
import "../lib/MathUint.sol";
import "../thirdparty/uniswap2/IUniswapV2Factory.sol";
import "../thirdparty/uniswap2/IUniswapV2Pair.sol";


/// @title Uniswap2PriceOracle
/// @dev Returns the value in Ether for any given ERC20 token.
contract UniswapV2PriceOracle is PriceOracle
{
    using MathUint   for uint;

    IUniswapV2Factory public immutable factory;
    address public immutable wethAddress;

    constructor(
        IUniswapV2Factory _factory,
        address           _wethAddress
        )
    {
        factory = _factory;
        wethAddress = _wethAddress;
        require(_wethAddress != address(0), "INVALID_WETH_ADDRESS");
    }

    function tokenValue(address token, uint amount)
        public
        view
        override
        returns (uint)
    {
        if (amount == 0 || amount == ~uint(0)) return 0;
        if (token == address(0) || token == wethAddress) return amount;

        address pair = factory.getPair(token, wethAddress);
        if (pair == address(0)) {
            return 0;
        }

        (uint112 reserve0, uint112 reserve1,) = IUniswapV2Pair(pair).getReserves();

        if (reserve0 == 0 || reserve1 == 0) {
            return 0;
        }

        if (token < wethAddress) {
            return amount.mul(reserve1.mul(1000) / reserve0) / 1000;
        } else {
            return amount.mul(reserve0.mul(1000) / reserve1) / 1000;
        }
    }
}
