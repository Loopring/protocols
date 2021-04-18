// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "./libamm/AmmData.sol";
import "./libamm/AmmPoolToken.sol";
import '../lib/ERC2612.sol';
import '../lib/MathUint.sol';


abstract contract PoolToken is ERC2612 {
    using MathUint     for uint;
    using AmmPoolToken for AmmData.State;

    uint   public constant decimals = 8;

    AmmData.State state;

    event Approval(address indexed owner, address indexed spender, uint value);
    event Transfer(address indexed from,  address indexed to,      uint value);

    function name()
        public
        view
        returns (string memory)
    {
        return state.poolName;
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
        view
        override
        returns (uint)
    {
        return state.totalSupply();
    }

    function balanceOf(address owner)
        public
        view
        override
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
        return spender == address(this) ?
            type(uint256).max :
            state.allowance[owner][spender];
    }

    function nonces(address owner)
        public
        view
        override
        returns (uint)
    {
        return state.nonces[owner];
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

    function permit(
        address        owner,
        address        spender,
        uint256        value,
        uint256        deadline,
        bytes calldata signature
        )
        external
        override
    {
        state.permit(owner, spender, value, deadline, signature);
    }
}
