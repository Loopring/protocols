// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../lib/Claimable.sol";
import "../lib/MathUint.sol";
import "../lib/TransferUtil.sol";
import "../amm/LoopringAmmPool.sol";

/// @author Brecht Devos - <brecht@loopring.org>
contract TestAssetManager is Claimable
{
    using MathUint         for uint;
    using TransferUtil     for address;

    mapping(address => mapping(address => uint)) public poolBalances;

    function withdraw(
        LoopringAmmPool pool,
        address         token,
        uint            amount
        )
        external
        onlyOwner
    {
        require(pool.isOnline(), "POOL_NOT_ONLINE");

        uint balanceBefore = token.selfBalance();

        pool.transferOut(address(this), token, amount);
        poolBalances[address(pool)][token] = poolBalances[address(pool)][token].add(amount);

        uint balanceAfter = token.selfBalance();
        require (balanceAfter == balanceBefore.add(amount), "WITHDRAWAL_INCONSISTENT");
    }

    function deposit(
        LoopringAmmPool pool,
        address         token,
        uint            amount
        )
        external
        onlyOwner
    {
        poolBalances[address(pool)][token] = poolBalances[address(pool)][token].sub(amount);
        token.transferOut(address(pool), amount);
    }

    function forceDeposit(
        LoopringAmmPool pool,
        address         token
        )
        external
    {
        require(!pool.isOnline(), "POOL_NOT_OFFLINE");

        uint amount = poolBalances[address(pool)][token];
        poolBalances[address(pool)][token] = 0;

        token.transferOut(address(pool), amount);
    }

    receive()
        external
        payable
    {}
}
