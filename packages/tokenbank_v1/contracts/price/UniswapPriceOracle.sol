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
pragma solidity ^0.5.11;

import "../iface/PriceOracle.sol";

contract UniswapFactoryInterface {
    // Get Exchange and Token Info
    function getExchange(address token) external view returns (address exchange);
    function getToken(address exchange) external view returns (address token);
}

contract UniswapExchangeInterface {
    // Address of ERC20 token sold on this exchange
    function tokenAddress() external view returns (address token);
    // Get Prices
    function getEthToTokenInputPrice(uint256 eth_sold) external view returns (uint256 tokens_bought);
    function getEthToTokenOutputPrice(uint256 tokens_bought) external view returns (uint256 eth_sold);
    function getTokenToEthInputPrice(uint256 tokens_sold) external view returns (uint256 eth_bought);
    function getTokenToEthOutputPrice(uint256 eth_bought) external view returns (uint256 tokens_sold);
}

/// @title UniswapPriceOracle
/// @dev Return the value in Ether for any given ERC20 token.
contract UniswapPriceOracle is PriceOracle
{
    UniswapFactoryInterface uniswapFactory;

    constructor(UniswapFactoryInterface _uniswapFactory)
        public
    {
        uniswapFactory = _uniswapFactory;
    }

    function tokenPrice(address token, uint amount)
        public
        view
        returns (uint value)
    {
        if (token == address(0)) return amount;

        address uniswap = uniswapFactory.getExchange(token);
        if (uniswap == address(0)) return 0; // no exchange

        return UniswapExchangeInterface(uniswap).getTokenToEthInputPrice(amount);
    }
}
