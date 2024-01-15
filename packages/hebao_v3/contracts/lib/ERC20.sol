// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;

/// @title ERC20 Token Interface
/// @dev see https://github.com/ethereum/EIPs/issues/20
/// @author Daniel Wang - <daniel@loopring.org>
abstract contract ERC20 {
    function totalSupply() public view virtual returns (uint);

    function balanceOf(address who) public view virtual returns (uint);

    function allowance(
        address owner,
        address spender
    ) public view virtual returns (uint);

    function transfer(address to, uint value) public virtual returns (bool);

    function transferFrom(
        address from,
        address to,
        uint value
    ) public virtual returns (bool);

    function approve(address spender, uint value) public virtual returns (bool);
}
