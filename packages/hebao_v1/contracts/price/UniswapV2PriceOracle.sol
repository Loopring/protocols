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
import "../iface/PriceOracle.sol";
import "../lib/MathUint.sol";


/// @title Uniswap2PriceOracle
/// @dev Returns the value in Ether for any given ERC20 token.
contract UniswapV2PriceOracle is PriceOracle
{
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

        address pair = factory.getPair(token, wethAddress);
        if (pair == address(0)) {
            return 0;
        }

        (uint112 reserve0, uint112 reserve1,) = IUniswapV2Pair(pair).getReserves();

        if (reserve0 == 0 || reserve1 == 0) {
            return 0;
        }

        if (token < wethAddress) {
            return amount.mul(reserve1) / reserve0;
        } else {
            return amount.mul(reserve0) / reserve1;
        }
    }
}
