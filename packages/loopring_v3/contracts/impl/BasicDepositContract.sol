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

import "../iface/IDepositContract.sol";
import "../iface/ILoopringV3.sol";

import "../lib/AddressUtil.sol";
import "../lib/ERC20.sol";
import "../lib/ERC20SafeTransfer.sol";
import "../lib/MathUint.sol";
import "../lib/ReentrancyGuard.sol";


/// @title Basic implementation of IDepositContract that just stores
///        all funds without doing anything with them.
///
///        Should be able to work with proxy contracts so the contract
///        can be updated easily (but with great caution and transparency!)
///        when necessary.
///
/// @author Brecht Devos - <brecht@loopring.org>
contract BasicDepositContract is IDepositContract, ReentrancyGuard
{
    using AddressUtil       for address;
    using ERC20SafeTransfer for address;
    using MathUint          for uint;

    event TokenNotOwnedByUsersWithdrawn(
        address sender,
        address token,
        address feeVault,
        uint    amount
    );

    // Max total amount that can be stored per token
    uint constant public MAX_TOTAL_TOKEN_BALANCE = 2 ** 96 - 1;

    address public exchange;
    ILoopringV3 public loopring;

    // A map from token address to the total exchange balances
    mapping (address => uint) public exchangeBalance;

    modifier onlyWhenUninitialized()
    {
        require(exchange == address(0), "INITIALIZED");
        _;
    }

    modifier onlyExchange()
    {
        require(msg.sender == exchange, "UNAUTHORIZED");
        _;
    }

    function initialize(
        address exchangeAddress,
        address loopringAddress
        )
        external
        nonReentrant
        onlyWhenUninitialized
    {
        exchange = exchangeAddress;
        loopring = ILoopringV3(loopringAddress);
    }

    function deposit(
        address from,
        address token,
        uint amount
        )
        external
        override
        nonReentrant
        payable
        onlyExchange
    {
        // Keep track how many tokens are deposited in the exchange
        exchangeBalance[token] = exchangeBalance[token].add(amount);
        // Make sure the total max amount per token in the exchange is capped
        require(exchangeBalance[token] <= MAX_TOTAL_TOKEN_BALANCE, "MAX_AMOUNT_REACHED");

        // Check msg.value
        if (isETHInternal(token)) {
            require(msg.value == amount, "INVALID_ETH_DEPOSIT");
        } else {
            require(msg.value == 0, "INVALID_TOKEN_DEPOSIT");
             // Transfer the tokens from the owner into this contract
            if (amount > 0) {
                token.safeTransferFromAndVerify(
                    from,
                    address(this),
                    amount
                );
            }
        }
    }

    function withdraw(
        address to,
        address token,
        uint amount
        )
        external
        override
        nonReentrant
        onlyExchange
    {
        // Keep track how many tokens are deposited in the exchange
        exchangeBalance[token] = exchangeBalance[token].sub(amount);

        // Transfer the tokens from the contract to the recipient
        transferOut(to, token, amount);
    }

    function transfer(
        address from,
        address to,
        address token,
        uint    amount
        )
        external
        override
        nonReentrant
        onlyExchange
    {
        require(token.safeTransferFrom(from, to, amount), "TRANSFER_FAILED");
    }

    function isETH(address addr)
        external
        override
        view
        returns (bool)
    {
        return isETHInternal(addr);
    }

    /// @dev Withdraws all tokens not owned by users, e.g., candies, airdrops, to fee vault.
    /// @param token The address of the token.
    /// @return amount The amount of tokens withdrawn
    function withdrawTokenNotOwnedByUsers(
        address token
        )
        external
        nonReentrant
        returns(uint amount)
    {
        address payable feeVault = loopring.protocolFeeVault();
        require(feeVault != address(0), "ZERO_ADDRESS");

        // Total balance in this contract
        uint totalBalance;
        if (isETHInternal(token)) {
            totalBalance = address(this).balance;
        } else {
            totalBalance = ERC20(token).balanceOf(address(this));
        }

        // Calculate the extra amount
        amount = totalBalance.sub(exchangeBalance[token]);

        // Transfer the extra tokens to the feeVault
        transferOut(feeVault, token, amount);

        emit TokenNotOwnedByUsersWithdrawn(msg.sender, token, feeVault, amount);
    }

    // -- Internal --

    function isETHInternal(address addr)
        internal
        pure
        returns (bool)
    {
        return addr == address(0);
    }

    function transferOut(
        address to,
        address token,
        uint amount
        )
        internal
    {
        if (amount > 0) {
            if (isETHInternal(token)) {
                // ETH
                to.sendETHAndVerify(amount, gasleft());
            } else {
                // ERC20 token
                token.safeTransferAndVerify(to, amount);
            }
        }
    }
}