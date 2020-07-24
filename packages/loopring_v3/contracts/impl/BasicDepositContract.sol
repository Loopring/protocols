// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.6.10;

import "../iface/IDepositContract.sol";

import "../lib/AddressUtil.sol";
import "../lib/Claimable.sol";
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
contract BasicDepositContract is IDepositContract, ReentrancyGuard, Claimable
{
    using AddressUtil       for address;
    using ERC20SafeTransfer for address;
    using MathUint          for uint;

    address public exchange;

    mapping (address => bool) needCheckBalance;

    modifier onlyExchange()
    {
        require(msg.sender == exchange, "UNAUTHORIZED");
        _;
    }

    modifier ifNonZero(uint amount)
    {
        if (amount == 0) return;
        else { _; }
    }

    event CheckBalance(
        address indexed token,
        bool            checkBalance
    );

    event Deposit   (address token, uint amount);
    event Withdrawal(address token, uint amount);

    function initialize(
        address _exchange
        )
        external
        onlyOwner
    {
        require(
            exchange == address(0) && _exchange != address(0),
            "INVALID_EXCHANGE"
        );
        exchange = _exchange;
    }

    function setCheckBalance(
        address token,
        bool    checkBalance
        )
        external
        onlyOwner
    {
        require(needCheckBalance[token] != checkBalance, "INVALID_VALUE");

        needCheckBalance[token] == checkBalance;
        emit CheckBalance(token, checkBalance);
    }

    function deposit(
        address from,
        address token,
        uint96  amount,
        bytes   calldata /*auxiliaryData*/
        )
        external
        override
        payable
        onlyExchange
        nonReentrant
        ifNonZero(amount)
        returns (uint96 actualAmount, uint /*tokenIndex*/)
    {
        if (isETHInternal(token)) {
            require(msg.value == uint(amount), "INVALID_ETH_DEPOSIT");
            actualAmount = amount;
        } else {
            require(msg.value == 0, "INVALID_TOKEN_DEPOSIT");

            bool checkBalance = needCheckBalance[token];
            uint balanceBefore = checkBalance ? ERC20(token).balanceOf(address(this)) : 0;

            token.safeTransferFromAndVerify(from, address(this), uint(amount));

            uint balanceAfter = checkBalance ? ERC20(token).balanceOf(address(this)) : amount;
            actualAmount = uint96(balanceAfter.sub(balanceBefore));
        }
        emit Deposit(token, actualAmount);
    }

    function withdraw(
        address to,
        address token,
        uint    amount,
        bytes   calldata /*auxiliaryData*/
        )
        external
        override
        payable
        onlyExchange
        nonReentrant
        ifNonZero(amount)
        returns (uint actualAmount)
    {
        if (isETHInternal(token)) {
            uint balance = address(this).balance;
            actualAmount = balance < amount ? balance : amount;
            to.sendETHAndVerify(actualAmount, gasleft());
        } else {
            // Just in case the balance is unexpectedly smaller
            uint balance = ERC20(token).balanceOf(address(this));
            actualAmount = balance < amount ? balance : amount;
            token.safeTransferAndVerify(to, actualAmount);
        }
         emit Withdrawal(token, actualAmount);
    }

    function transfer(
        address from,
        address to,
        address token,
        uint    amount
        )
        external
        override
        payable
        onlyExchange
        nonReentrant
        ifNonZero(amount)
    {
        token.safeTransferFromAndVerify(from, to, amount);
    }

    function isETH(address addr)
        external
        override
        view
        returns (bool)
    {
        return isETHInternal(addr);
    }

    // -- Internal --

    function isETHInternal(address addr)
        internal
        pure
        returns (bool)
    {
        return addr == address(0);
    }
}