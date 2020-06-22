/*

  Copyright 2017 Loopring Project Ltd (Loopring Foundation).

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/
pragma solidity ^0.6.6;

import "../thirdparty/uniswap2/IUniswapV2Factory.sol";
import "../thirdparty/uniswap2/IUniswapV2Pair.sol";
import "../thirdparty/uniswap2/FixedPoint.sol";
import "../thirdparty/uniswap2/UniswapV2Library.sol";
import "../thirdparty/uniswap2/UniswapV2OracleLibrary.sol";

import "../iface/PriceOracle.sol";

import "../lib/MathUint.sol";

/// @title Uniswap2PriceOracle
/// @dev Returns the value in Ether for any given ERC20 token.
contract UniswapV2PriceOracle is PriceOracle
{
    using FixedPoint for *;
    using MathUint   for uint;

    IUniswapV2Factory factory;
    address wethAddress;

    constructor(
        IUniswapV2Factory _factory,
        address           _wethAddress
        )
        public
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
        if (amount == 0) return 0;
        if (token == address(0) || token == wethAddress) return amount;

        address pairAddress = factory.getPair(token, wethAddress);
        if (pairAddress == address(0)) {
            return 0;
        }

        IUniswapV2Pair pair = IUniswapV2Pair(pairAddress);
        (uint112 reserve0, uint112 reserve1,) = pair.getReserves();

        if (reserve0 == 0 || reserve1 == 0) {
            return 0;
        }

        (uint price0Cumulative, uint price1Cumulative, uint32 blockTimestamp) =
            UniswapV2OracleLibrary.currentCumulativePrices(pairAddress);

        uint timeElapsed = block.timestamp - blockTimestamp;

        if (token < wethAddress) {
            return computeAmountOut(
                price0Cumulative,
                pair.price0CumulativeLast(),
                timeElapsed,
                amount
            );
        } else {
            return computeAmountOut(
                price1Cumulative,
                pair.price1CumulativeLast(),
                timeElapsed,
                amount
            );
        }
    }

    // Given the cumulative prices of the start and end of a period,
    // and the length of the period, compute the average
    // price in terms of how much amount out is received for the amount in
    function computeAmountOut(
        uint price1Cumulative,
        uint price1CumulativeLast,
        uint timeElapsed,
        uint amountIn
        )
        private
        pure
        returns (uint amountOut)
    {
        // overflow is desired.
        return FixedPoint.uq112x112(
            uint224((price1Cumulative - price1CumulativeLast) / timeElapsed)
        ).mul(amountIn).decode144();
    }
}
