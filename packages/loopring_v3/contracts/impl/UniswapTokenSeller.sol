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

    using MathUint          for uint;

    uint    public constant SLIPPAGE = 1; // 1 percentage

    address public uniswapFactorAddress;
    address public recipient;

    event TokenSold (
        address indexed seller,
        address indexed recipient,
        address         tokenS,
        address         tokenB,
        uint            amountS,
        uint            amountB,
        uint            time
    );

    constructor(
        address _uniswapFactorAddress,
        address _recipient
        )
        public
    {
        require(_uniswapFactorAddress != address(0), "ZERO_ADDRESS");
        uniswapFactorAddress = _uniswapFactorAddress;
        recipient = _recipient;
    }

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

        uint amountS; // amount to sell
        uint amountB; // amount bought
        uint noDeadline = now;
        UniswapExchangeInterface exchange;

        if (tokenS == address(0)) {
            // Sell ETH to ERC20
            amountS = address(this).balance;
            require(amountS > 0, "ZERO_AMOUNT");
            exchange = getUniswapExchange(tokenB);

            uint minAmountB = exchange.getEthToTokenInputPrice(amountS);
            amountB = exchange.ethToTokenTransferInput.value(amountS)(
                applySlippage(minAmountB),
                noDeadline,
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
                uint minAmountB = exchange.getTokenToEthInputPrice(amountS);

                amountB = exchange.tokenToEthTransferInput(
                    amountS,
                    applySlippage(minAmountB),
                    noDeadline,
                    _recipient
                );
            } else {
                // Sell ERC20 to ERC20
                uint minAmountEth = exchange.getTokenToEthInputPrice(amountS);
                uint minAmountB = getUniswapExchange(tokenB).getEthToTokenInputPrice(minAmountEth);

                amountB = exchange.tokenToTokenTransferInput(
                    amountS,
                    applySlippage(minAmountB),
                    0, // do not check minAmountEth
                    noDeadline,
                    _recipient,
                    tokenB
                );
            }
        }

        emit TokenSold(msg.sender, _recipient, tokenS, tokenB, amountS, amountB, now);

        return true;
    }

    function getUniswapExchange(address token)
        private
        view
        returns (UniswapExchangeInterface)
    {
        UniswapFactoryInterface factory = UniswapFactoryInterface(uniswapFactorAddress);
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
                token.approve(address(exchange), 2 ** 256 - 1),
                "APPROVAL_FAILURE"
            );
        }
    }

    function applySlippage(uint amount)
        private
        view
        returns (uint)
    {
        return amount.mul(100 - SLIPPAGE) / 100;
    }
}
