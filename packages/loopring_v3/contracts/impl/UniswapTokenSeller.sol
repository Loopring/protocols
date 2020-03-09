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

import "../iface/ITokenSeller.sol";

import "../lib/ERC20.sol";
import "../lib/MathUint.sol";
import "../lib/ReentrancyGuard.sol";

import "../thirdparty/UniswapExchangeInterface.sol";
import "../thirdparty/UniswapFactoryInterface.sol";


/// @title An ITokenSeller that sells token on Uniswap.
/// @dev This contract will sell all tokens or Ether received to other tokens or Ether
//       using the Uniswap contracts.
/// @author Daniel Wang  - <daniel@loopring.org>
contract UniswapTokenSeller is ReentrancyGuard, ITokenSeller {

    using MathUint for uint;

    uint256 constant MAX_UINT = ~uint(0);
    uint    public constant MAX_SLIPPAGE_BIPS = 100; // 1 percent
    address public uniswapFactoryAddress; // 0xc0a47dFe034B400B47bDaD5FecDa2621de6c4d95 on live
    address public recipient;

    event TokenSold (
        address indexed seller,
        address indexed recipient,
        address         tokenS,
        address         tokenB,
        uint            amountS,
        uint            amountB,
        uint8           slippage,
        uint64          time
    );

    constructor(
        address _uniswapFactoryAddress,
        address _recipient
        )
        public
    {
        require(_uniswapFactoryAddress != address(0), "ZERO_ADDRESS");
        uniswapFactoryAddress = _uniswapFactoryAddress;
        recipient = _recipient;
    }

    function() external payable { }

    function sellToken(
        address tokenS,
        address tokenB
        )
        external
        payable
        nonReentrant
        returns (bool success)
    {
        require(tokenS != tokenB, "SAME_TOKEN");

        // If `recipient` is set to non-zero, we send all purchased Ether/token to it.
        address _recipient = recipient == address(0) ? msg.sender : recipient;
        uint  amountS; // amount to sell
        uint  amountB; // amount bought
        uint8 slippage;
        UniswapExchangeInterface exchange;

        if (tokenS == address(0)) {
            // Sell ETH to ERC20
            amountS = address(this).balance;
            require(amountS > 0, "ZERO_AMOUNT");
            exchange = getUniswapExchange(tokenB);

            slippage = getSlippage(
                exchange.getEthToTokenInputPrice(amountS),
                exchange.getEthToTokenInputPrice(amountS.mul(2))
            );

            amountB = exchange.ethToTokenTransferInput.value(amountS)(
                1,  // min_tokens_bought
                MAX_UINT,
                _recipient
            );
        } else {
            // Selling ERC20 to ETH or other ERC20
            amountS = ERC20(tokenS).balanceOf(address(this));
            require(amountS > 0, "ZERO_AMOUNT");
            exchange = getUniswapExchange(tokenS);

            approveUniswapExchange(exchange, tokenS, amountS);

            if (tokenB == address(0)) {
                // Sell ERC20 to ETH
                slippage = getSlippage(
                    exchange.getTokenToEthInputPrice(amountS),
                    exchange.getTokenToEthInputPrice(amountS.mul(2))
                );

                amountB = exchange.tokenToEthTransferInput(
                    amountS,
                    1,  // min_eth_bought
                    MAX_UINT,
                    _recipient
                );
            } else {
                // Sell ERC20 to ERC20
                UniswapExchangeInterface exchangeB = getUniswapExchange(tokenB);
                slippage = getSlippage(
                    exchangeB.getEthToTokenInputPrice(exchange.getTokenToEthInputPrice(amountS)),
                    exchangeB.getEthToTokenInputPrice(exchange.getTokenToEthInputPrice(amountS.mul(2)))
                );

                amountB = exchange.tokenToTokenTransferInput(
                    amountS,
                    1, //  min_tokens_bought
                    1, //  min_eth_bought
                    MAX_UINT,
                    _recipient,
                    tokenB
                );
            }
        }

        emit TokenSold(
            msg.sender,
            _recipient,
            tokenS,
            tokenB,
            amountS,
            amountB,
            slippage,
            uint64(now)
        );

        return true;
    }

    function getUniswapExchange(address token)
        private
        view
        returns (UniswapExchangeInterface)
    {
        UniswapFactoryInterface factory = UniswapFactoryInterface(uniswapFactoryAddress);
        return UniswapExchangeInterface(factory.getExchange(token));
    }

    function approveUniswapExchange(
        UniswapExchangeInterface exchange,
        address tokenS,
        uint    amountS
        )
        private
    {
        ERC20 token = ERC20(tokenS);
        uint allowance = token.allowance(address(this), address(exchange));
        if (allowance < amountS) {
            require(
                token.approve(address(exchange), MAX_UINT),
                "APPROVAL_FAILURE"
            );
        }
    }

    function getSlippage(
        uint amountB,
        uint amountB2
        )
        private
        pure
        returns (uint8)
    {
        require(amountB > 0 && amountB2 > 0, "INVALID_PRICE");
        uint slippageBips = amountB.mul(2).sub(amountB2).mul(10000) / amountB;
        require(slippageBips <= MAX_SLIPPAGE_BIPS, "SLIPPAGE_TOO_LARGE");
        return uint8(slippageBips);
    }
}
