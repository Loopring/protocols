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
pragma experimental ABIEncoderV2;

import "../../base/BaseSubAccount.sol";
import "../../lib/ERC20.sol";
import "../../lib/MathUint.sol";
import "../../iface/Wallet.sol";
import "../../iface/SubAccount.sol";
import "../../thirdparty/uniswap/UniswapExchangeInterface.sol";
import "../../thirdparty/uniswap/UniswapFactoryInterface.sol";

import "../security/SecurityModule.sol";

/// @title UniswapModule
contract UniswapModule is BaseSubAccount, SecurityModule
{
    using MathUint for uint;
    using MathInt for int;
    UniswapFactoryInterface uniswapFactory;
    address constant internal ETH_TOKEN_ADDRESS = address(0);
    address constant internal UNISWAP_ETH_TOKEN_ADDRESS = address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE);

    constructor(
        Controller _controller,
        UniswapFactoryInterface _uniswapFactory
        )
        public
        SecurityModule(_controller)
    {
        require(address(_uniswapFactory) != address(0), "ZERO_ADDRESS");
        uniswapFactory = _uniswapFactory;
    }

    function boundMethods()
        public
        pure
        returns (bytes4[] memory methods)
    {
        // TODO
    }

    function extractMetaTxSigners(
        address wallet,
        bytes4  method,
        bytes   memory /* data */
        )
        internal
        view
        returns (address[] memory signers)
    {
        // TODO
    }

    // SubAccount interfaces
    // ...
    /// @dev Deposits Ether/token from the wallet to this sub-account.
    /// @param wallet The wallt from which the Ether/token will be transfered out.
    /// @param signers The list of meta-transaction signers, must be emptpy for normal transactions.
    /// @param token The token address, use 0x0 for Ether.
    /// @param amount The amount of Ether/token to transfer.
    function deposit(
        address            wallet,
        address[] calldata signers,
        address            token,
        uint               amount
        )
        external
    {
        // TODO: enable signers later
        require(signers.length == 0, "NOT_SUPPORT_NOW");

        require(amount > 0, "Uniswap: can't add 0 liquidity");
        address tokenPool = uniswapFactory.getExchange(token);
        require(tokenPool != address(0), "Uniswap: target token is not traded on Uniswap");

        uint256 tokenBalance = ERC20(token).balanceOf(address(wallet));
        if(amount > tokenBalance) {
            uint256 ethToSwap = UniswapExchangeInterface(tokenPool).getEthToTokenOutputPrice(amount - tokenBalance);
            require(ethToSwap <= address(wallet).balance, "Uniswap: not enough ETH to swap");
            transactCall(
                wallet,
                tokenPool,
                ethToSwap,
                abi.encodeWithSignature("ethToTokenSwapOutput(uint256,uint256)", amount - tokenBalance, block.timestamp)
            );
        }

        uint256 tokenLiquidity = ERC20(token).balanceOf(tokenPool);
        uint256 ethLiquidity = tokenPool.balance;
        uint256 ethToPool = (amount - 1).mul(ethLiquidity).div(tokenLiquidity);
        require(ethToPool <= address(wallet).balance, "Uniswap: not enough ETH to pool");
        transactCall(wallet, token, 0, abi.encodeWithSignature("approve(address,uint256)", tokenPool, amount));
        transactCall(
            wallet,
            tokenPool,
            ethToPool,
            abi.encodeWithSignature("addLiquidity(uint256,uint256,uint256)",1, amount, block.timestamp + 1)
        );
        trackDeposit(wallet, token, amount);
    }

    /// @dev Withdraw Ether/token from this sub-account to the wallet.
    /// @param wallet The wallt to which the Ether/token will be transfered to.
    /// @param signers The list of meta-transaction signers, must be emptpy for normal transactions.
    /// @param token The token address, use 0x0 for Ether.
    /// @param amount The amount of Ether/token to transfer.
    function withdraw(
        address            wallet,
        address[] calldata signers,
        address            token,
        uint               amount
    )
        external
    {
        // TODO: enable signers later
        require(signers.length == 0, "NOT_SUPPORT_NOW");

        address tokenPool = uniswapFactory.getExchange(token);
        require(tokenPool != address(0), "Uniswap: The target token is not traded on Uniswap");

        int tokenAmount = tokenBalance(wallet, token);
        require(tokenAmount >= int(amount), "NOT_ENOUGH_BALANCE");

        int shares = int(ERC20(tokenPool).balanceOf(address(wallet)));
        int burnedAmount = int(amount) * shares / tokenAmount;
        transactCall(
            wallet,
            tokenPool,
            0,
            abi.encodeWithSignature("removeLiquidity(uint256,uint256,uint256,uint256)",
            burnedAmount,   // how many UNIs are burned.
            1,              // min eth to be withdraw.
            amount,         // min token to be withdraw.
            block.timestamp + 1));
        trackDeposit(wallet, token, amount);
    }

    function tokenBalance (
        address wallet,
        address token
    )
        public
        view
        returns (int)
    {
        int tokenValue;
        require(token != ETH_TOKEN_ADDRESS, "ERC20_TOKEN_BALANCE_ONLY");
        (tokenValue, ) = tokenBalanceImpl(wallet, token);
        return int(tokenValue);
    }

    function tokenBalances(
        address wallet,
        address[] memory tokens
    )
        public
        view
        returns (int[] memory balances)
    {
        require(tokens.length > 0, "EMPTY_TOKENS");
        balances = new int[](tokens.length);
        uint ethTokenIdx = tokens.length;
        int ethTotalBalance = 0;
        for (uint i = 0; i < tokens.length; ++i)
        {
            if (tokens[i] != ETH_TOKEN_ADDRESS) {
                int ethEntryBalance = 0;
                (balances[i], ethEntryBalance) = tokenBalanceImpl(wallet, tokens[i]);
                ethTotalBalance += ethEntryBalance;
            } else {
                ethTokenIdx = i;
            }
        }
        if (ethTokenIdx < tokens.length) {
            balances[ethTokenIdx] = ethTotalBalance;
        }
    }

    // Internal functions
    // ...
    function tokenBalanceImpl(
        address wallet,
        address token
    )
        internal
        view
        returns (
            int token_amount,
            int eth_amount
        )
    {
        address tokenPool = uniswapFactory.getExchange(token);
        require(tokenPool != address(0), "NO_EXCHANGE");
        int tokenPoolSize = int(ERC20(token).balanceOf(tokenPool));
        int shares = int(ERC20(tokenPool).balanceOf(address(wallet)));
        int totalSupply = int(ERC20(tokenPool).totalSupply());
        token_amount = shares.mul(tokenPoolSize).div(totalSupply);
        eth_amount = shares.mul(int(tokenPool.balance)).div(totalSupply);
        return (token_amount, eth_amount);
    }
}
