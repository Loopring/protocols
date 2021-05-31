// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../lib/Claimable.sol";
import "../lib/MathUint.sol";
import "../lib/TransferUtil.sol";
import "../amm/LoopringAmmPool.sol";
import "../amm/IAssetManager.sol";

/// @author Brecht Devos - <brecht@loopring.org>
contract TestAssetManager is IAssetManager, Claimable
{
    using MathUint         for uint;
    using TransferUtil     for address;

    mapping(address => mapping(address => uint)) public poolBalances;

    function getBalances(
        address          pool,
        address[] memory tokens
        )
        external
        view
        returns (uint[] memory)
    {
        uint[] memory balances = new uint[](tokens.length);
        for (uint i = 0; i < tokens.length; i++) {
            balances[i] = poolBalances[address(pool)][tokens[i]];
        }
        return balances;
    }

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
        delete poolBalances[address(pool)][token];

        token.transferOut(address(pool), amount);
    }

    receive()
        external
        payable
    {}
}
