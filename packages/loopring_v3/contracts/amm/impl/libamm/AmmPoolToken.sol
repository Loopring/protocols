// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "./AmmData.sol";
import "../../../lib/MathUint.sol";


/// @title AmmPoolToken
library AmmPoolToken
{
    using MathUint for uint;

    event Approval(address indexed owner, address indexed spender, uint value);
    event Transfer(address indexed from,  address indexed to,      uint value);

    function approve(
        AmmData.State storage S,
        address               spender,
        uint                  value
        )
        internal
        returns (bool)
    {
        S.allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transfer(
        AmmData.State storage S,
        address               to,
        uint                  value
        )
        internal
        returns (bool)
    {
        S.balanceOf[msg.sender] = S.balanceOf[msg.sender].sub(value);
        S.balanceOf[to] = S.balanceOf[to].add(value);
        emit Transfer(msg.sender, to, value);

        return true;
    }

    function transferFrom(
        AmmData.State storage S,
        address               from,
        address               to,
        uint                  value
        )
        internal
        returns (bool)
    {
        if (S.allowance[from][msg.sender] != uint(-1)) {
            S.allowance[from][msg.sender] = S.allowance[from][msg.sender].sub(value);
        }
        S.balanceOf[from] = S.balanceOf[from].sub(value);
        S.balanceOf[to] = S.balanceOf[to].add(value);
        emit Transfer(from, to, value);
        return true;
    }

    function mint(
        AmmData.State storage S,
        address               to,
        uint                  value
        )
        internal
    {
        S.totalSupply = S.totalSupply.add(value);
        S.balanceOf[to] = S.balanceOf[to].add(value);
        emit Transfer(address(0), to, value);
    }

    function burn(
        AmmData.State storage S,
        address               from,
        uint                  value
        )
        internal
    {
        S.balanceOf[from] = S.balanceOf[from].sub(value);
        S.totalSupply = S.totalSupply.sub(value);
        emit Transfer(from, address(0), value);
    }
}
