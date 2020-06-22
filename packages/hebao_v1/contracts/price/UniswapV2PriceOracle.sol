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
import "../thirdparty/uniswap2/UniswapV2OracleLibrary.sol";

import "../iface/PriceOracle.sol";

import "../lib/MathUint.sol";

/// @title Uniswap2PriceOracle
/// @dev Returns the value in Ether for any given ERC20 token.
contract UniswapV2PriceOracle is PriceOracle
{
    using FixedPoint for *;
    using MathUint for uint;

    IUniswapV2Factory uniswapV2Factory;
    address wethAddress;

    constructor(
        IUniswapV2Factory _uniswapV2Factory,
        address           _wethAddress
        )
        public
    {
        uniswapV2Factory = _uniswapV2Factory;
        wethAddress = _wethAddress;
    }

    // given the cumulative prices of the start and end of a period,
    // and the length of the period, compute the average
    // price in terms of how much amount out is received for the amount in
    function computeAmountOut(
        uint priceCumulativeStart, uint priceCumulativeEnd,
        uint timeElapsed, uint amountIn
    ) private pure returns (uint amountOut) {
        // overflow is desired.
        FixedPoint.uq112x112 memory priceAverage = FixedPoint.uq112x112(
            uint224((priceCumulativeEnd - priceCumulativeStart) / timeElapsed)
        );
        amountOut = priceAverage.mul(amountIn).decode144();
    }

    // Using UniswapV2's sliding window price.
    function tokenValue(address token, uint amount)
        public
        view
        override
        returns (uint)
    {
        if (amount == 0) return 0;
        if (token == address(0) || token == wethAddress) return amount;

        address pair = uniswapV2Factory.getPair(token, wethAddress);
        if (pair == address(0)) return 0; // no pair

        (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast) =
            IUniswapV2Pair(pair).getReserves();

        uint timeElapsed = block.timestamp - blockTimestampLast;
        (uint price0Cumulative, uint price1Cumulative,) =
            UniswapV2OracleLibrary.currentCumulativePrices(pair);
        (address token0,) = sortTokens(token, wethAddress);
        if (token0 == token) {
            return computeAmountOut(reserve0,
                                    price0Cumulative,
                                    timeElapsed,
                                    amount);
        } else {
            return computeAmountOut(reserve1,
                                    price1Cumulative,
                                    timeElapsed,
                                    amount);
        }
    }

    /// returns sorted token addresses, used to handle return values from pairs sorted in this order
    /// taken from UniswapV2Library
    function sortTokens(address tokenA, address tokenB)
        internal
        pure
        returns (address token0, address token1)
    {
        require(tokenA != tokenB, "UniswapV2Library: IDENTICAL_ADDRESSES");
        (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), "UniswapV2Library: ZERO_ADDRESS");
    }
}
