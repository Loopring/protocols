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

import "../thirdparty/uniswap/UniswapExchangeInterface.sol";
import "../thirdparty/uniswap/UniswapFactoryInterface.sol";

import "../iface/PriceOracle.sol";


/// @title UniswapPriceOracle
/// @dev Returns the value in Ether for any given ERC20 token.
contract UniswapPriceOracle is PriceOracle
{
    UniswapFactoryInterface uniswapFactory;

    constructor(UniswapFactoryInterface _uniswapFactory)
        public
    {
        uniswapFactory = _uniswapFactory;
    }

    function tokenValue(address token, uint amount)
        public
        view
        override
        returns (uint value)
    {
        if (amount == 0) return 0;
        if (token == address(0)) return amount;

        address exchange = uniswapFactory.getExchange(token);
        if (exchange == address(0)) return 0; // no exchange

        return UniswapExchangeInterface(exchange).getTokenToEthInputPrice(amount);
    }
}
