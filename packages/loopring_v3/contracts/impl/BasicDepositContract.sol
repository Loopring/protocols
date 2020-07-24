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


/// @title Default implementation of IDepositContract that just stores
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

    modifier ifNotZero(uint amount)
    {
        if (amount == 0) return;
        else { _; }
    }

    event CheckBalance(
        address indexed token,
        bool            checkBalance
    );

    event Deposit   (address token, uint amountReceived);
    event Withdrawal(address token, uint amountPaid);

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
        ifNotZero(amount)
        returns (uint96 amountReceived, uint /*tokenIndex*/)
    {
        if (isETHInternal(token)) {
            require(msg.value == amount, "INVALID_ETH_DEPOSIT");
            amountReceived = amount;
        } else {
            require(msg.value == 0, "INVALID_TOKEN_DEPOSIT");

            bool checkBalance = needCheckBalance[token];
            uint balanceBefore = checkBalance ? ERC20(token).balanceOf(address(this)) : 0;

            token.safeTransferFromAndVerify(from, address(this), uint(amount));

            uint balanceAfter = checkBalance ? ERC20(token).balanceOf(address(this)) : amount;
            uint diff = balanceAfter.sub(balanceBefore);
            amountReceived = uint96(diff);
            require(uint(amountReceived) == diff, "OUT_OF_RANGE");
        }
        emit Deposit(token, amountReceived);
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
        ifNotZero(amount)
        returns (uint amountPaid)
    {
        amountPaid = amount;
        if (isETHInternal(token)) {
            to.sendETHAndVerify(amountPaid, gasleft());
        } else {
            if(!token.safeTransfer(to, amountPaid)){
                amountPaid = ERC20(token).balanceOf(address(this));
                require(amountPaid < amount, "UNEXCPECTED");
                token.safeTransferAndVerify(to, amountPaid);
            }
        }
        emit Withdrawal(token, amountPaid);
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
        ifNotZero(amount)
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