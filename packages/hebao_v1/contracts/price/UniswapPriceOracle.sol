// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.6.10;

import "../iface/PriceOracle.sol";
import "../thirdparty/uniswap/UniswapExchangeInterface.sol";
import "../thirdparty/uniswap/UniswapFactoryInterface.sol";


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
        external
        view
        override
        returns (uint)
    {
        if (amount == 0) return 0;
        if (token == address(0)) return amount;

        address exchange = uniswapFactory.getExchange(token);
        if (exchange == address(0)) return 0; // no exchange

        return UniswapExchangeInterface(exchange).getTokenToEthInputPrice(amount);
    }
}
