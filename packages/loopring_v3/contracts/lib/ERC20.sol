// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;


/// @title ERC20 Token Interface
/// @dev see https://github.com/ethereum/EIPs/issues/20
/// @author Daniel Wang - <daniel@loopring.org>
interface ERC20
{
    function totalSupply()
        external
        view
        returns (uint);

    function balanceOf(
        address who
        )
        external
        view
        returns (uint);

    function allowance(
        address owner,
        address spender
        )
        external
        view
        returns (uint);

    function transfer(
        address to,
        uint value
        )
        external
        returns (bool);

    function transferFrom(
        address from,
        address to,
        uint    value
        )
        external
        returns (bool);

    function approve(
        address spender,
        uint    value
        )
        external
        returns (bool);
}
