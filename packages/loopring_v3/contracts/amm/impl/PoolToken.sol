// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "./libamm/AmmData.sol";
import "./libamm/AmmPoolToken.sol";
import '../../lib/ERC20.sol';
import '../../lib/MathUint.sol';


contract PoolToken is ERC20 {
    using MathUint     for uint;
    using AmmPoolToken for AmmData.State;

    // TODO:support permit
    uint   public constant decimals = 18;

    AmmData.State state;

    event Approval(address indexed owner, address indexed spender, uint value);
    event Transfer(address indexed from,  address indexed to,      uint value);

    function name()
        public
        view
        returns (string memory)
    {
        return state.name;
    }

    function symbol()
        public
        view
        returns (string memory)
    {
        return state.symbol;
    }

    function totalSupply()
        public
        virtual
        view
        override
        returns (uint)
    {
        return state.totalSupply;
    }

    function balanceOf(address owner)
        public
        view
        override
        virtual
        returns (uint balance)
    {
        return state.balanceOf[owner];
    }

    function allowance(address owner, address spender)
        public
        view
        override
        returns (uint)
    {
        return state.allowance[owner][spender];
    }

    function approve(address spender, uint value)
        public
        override
        returns (bool)
    {
        return state.approve(spender, value);
    }

    function transfer(address to, uint value)
        public
        override
        returns (bool)
    {
        return state.transfer(to, value);
    }

    function transferFrom(address from, address to, uint value)
        public
        override
        returns (bool)
    {
       return state.transferFrom(from, to, value);
    }

    function mint(address to, uint value)
        internal
    {
        state.mint(to, value);
    }

    function burn(address from, uint value)
        internal
    {
        state.burn(from, value);
    }
}
