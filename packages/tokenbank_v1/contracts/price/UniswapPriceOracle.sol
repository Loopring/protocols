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
import "../lib/Ownable.sol";

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
contract UniswapPriceOracle is PriceOracle, Ownable
{
    UniswapFactoryInterface uniswapFactory;

    function setUniswapFactory(address UniswapFactoryAddress)
        public
        onlyOwner
    {
        require(UniswapFactoryAddress != address(0), "ZERO_ADDRESS");
        uniswapFactory = UniswapFactoryInterface(UniswapFactoryAddress);
    }

    function tokenPrice(address token, uint amount)
        public
        view
        returns (uint value)
    {
        require(address(uniswapFactory) != address(0), "uniswapFactory is None");
        UniswapExchangeInterface tokenExchange = UniswapExchangeInterface(uniswapFactory.getExchange(token));
        if (address(tokenExchange) == address(0)) {
            // No exchange for this token
            return 0;
        }
        return tokenExchange.getTokenToEthInputPrice(amount);
    }
}
