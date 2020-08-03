// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

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
        address indexed tokenAddr,
        bool            checkBalance
    );

    function initialize(
        address _exchange
        )
        external
    {
        require(
            exchange == address(0) && _exchange != address(0),
            "INVALID_EXCHANGE"
        );
        owner = msg.sender;
        exchange = _exchange;
    }

    function setCheckBalance(
        address tokenAddr,
        bool    checkBalance
        )
        external
        onlyOwner
    {
        require(needCheckBalance[tokenAddr] != checkBalance, "INVALID_VALUE");

        needCheckBalance[tokenAddr] = checkBalance;
        emit CheckBalance(tokenAddr, checkBalance);
    }

    function deposit(
        address from,
        address tokenAddr,
        uint    tokenTid,
        uint96  amount,
        bytes   calldata /*auxiliaryData*/
        )
        external
        override
        payable
        onlyExchange
        //nonReentrant
        ifNotZero(amount)
        returns (uint96 amountReceived)
    {
        require(tokenTid == 0, "ERC20_ONLY");

        if (isETHInternal(tokenAddr)) {
            require(msg.value == amount, "INVALID_ETH_DEPOSIT");
            amountReceived = amount;
        } else {
            require(msg.value == 0, "INVALID_TOKEN_DEPOSIT");

            bool checkBalance = needCheckBalance[tokenAddr];
            uint balanceBefore = checkBalance ? ERC20(tokenAddr).balanceOf(address(this)) : 0;

            tokenAddr.safeTransferFromAndVerify(from, address(this), uint(amount));

            uint balanceAfter = checkBalance ? ERC20(tokenAddr).balanceOf(address(this)) : amount;
            uint diff = balanceAfter.sub(balanceBefore);
            amountReceived = uint96(diff);
            require(uint(amountReceived) == diff, "OUT_OF_RANGE");
        }
    }

    function withdraw(
        address /*from*/,
        address to,
        address tokenAddr,
        uint    tokenTid,
        uint    amount,
        bytes   calldata /*auxiliaryData*/
        )
        external
        override
        payable
        onlyExchange
        //nonReentrant
        ifNotZero(amount)
    {
        require(tokenTid == 0, "ERC20_ONLY");

        if (isETHInternal(tokenAddr)) {
            to.sendETHAndVerify(amount, gasleft());
        } else {
            if(!tokenAddr.safeTransfer(to, amount)){
                uint amountPaid = ERC20(tokenAddr).balanceOf(address(this));
                require(amountPaid < amount, "UNEXPECTED");
                tokenAddr.safeTransferAndVerify(to, amountPaid);
            }
        }
    }

    function transfer(
        address from,
        address to,
        address tokenAddr,
        uint    tokenTid,
        uint    amount
        )
        external
        override
        payable
        onlyExchange
        //nonReentrant
        ifNotZero(amount)
    {
        require(tokenTid == 0, "ERC20_ONLY");

        tokenAddr.safeTransferFromAndVerify(from, to, amount);
    }

    function isETH(address tokenAddr)
        external
        override
        pure
        returns (bool)
    {
        return isETHInternal(tokenAddr);
    }

    // -- Internal --

    function isETHInternal(address tokenAddr)
        internal
        pure
        returns (bool)
    {
        return tokenAddr == address(0);
    }
}