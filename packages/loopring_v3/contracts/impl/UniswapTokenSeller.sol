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
import "../thirdparty/UniswapExchangeInterface.sol";
import "../thirdparty/UniswapFactoryInterface.sol";


/// @title An ITokenSeller that sells token on Uniswap.
/// @author Daniel Wang  - <daniel@loopring.org>
contract UniswapTokenSeller is ITokenSeller {

    event TokenSold(
        address indexed seller,
        address         tokenS,
        uint            amountS,
        address         tokenB,
        uint            amountB,
        uint            time
    );

    address constant public UNISWAP_FACTORY_ADDRESS = address(0);
    UniswapFactoryInterface factory = UniswapFactoryInterface(UNISWAP_FACTORY_ADDRESS);

    function sellToken(
        address tokenS,
        address tokenB
        )
        external
        payable
        returns (bool success)
    {
        require(tokenS != tokenB, "SAME_TOKEN");
        uint amountS;
        uint deadline = now; // This means there is no deadline at all.
        uint purchased;

        if (tokenS == address(0)) { // Sell ETH to ERC20
            amountS = address(this).balance;
            require(amountS > 0, "ZERO_AMOUNT");
            UniswapExchangeInterface exchange = UniswapExchangeInterface(factory.getExchange(tokenB));

            uint minPurchase = exchange.getEthToTokenInputPrice(amountS);
            purchased = exchange.ethToTokenTransferInput.value(amountS)(
                minPurchase,
                deadline,
                msg.sender
            );
        } else if (tokenB == address(0)) { // Sell ERC20 to ETH

            amountS = ERC20(tokenS).balanceOf(address(this));
            require(amountS > 0, "ZERO_AMOUNT");
            UniswapExchangeInterface exchange = UniswapExchangeInterface(factory.getExchange(tokenS));
            uint minPurchase = exchange.getTokenToEthInputPrice(amountS);

            authorizeUniswap(tokenS, amountS);
            purchased =exchange.tokenToEthTransferInput(
                amountS,
                minPurchase,
                deadline,
                msg.sender
            );

        } else { // Sell ERC20 to ERC20
            amountS = ERC20(tokenS).balanceOf(address(this));
            require(amountS > 0, "ZERO_AMOUNT");
            UniswapExchangeInterface exchangeS = UniswapExchangeInterface(factory.getExchange(tokenS));
            UniswapExchangeInterface exchangeB = UniswapExchangeInterface(factory.getExchange(tokenB));

            uint minPurchaseEther = exchangeS.getTokenToEthInputPrice(amountS);
            uint minPurchaseToken = exchangeB.getEthToTokenInputPrice(minPurchaseEther);

            authorizeUniswap(tokenS, amountS);
            purchased = exchangeS.tokenToTokenTransferInput(
                amountS,
                minPurchaseToken,
                0, // min_eth_bought
                deadline,
                msg.sender,
                tokenB
            );
        }

        emit TokenSold(msg.sender, tokenS, amountS, tokenB, purchased, now);
        return true;
    }

    function authorizeUniswap(
        address tokenS,
        uint    amountS
        )
        internal
    {
        ERC20 token = ERC20(tokenS);
        uint allowance = token.allowance(address(this), UNISWAP_FACTORY_ADDRESS);
        if (allowance < amountS) {
            require(token.approve(UNISWAP_FACTORY_ADDRESS, 2**256 - 1), "AUTH_FAILURE");
        }
    }
}
