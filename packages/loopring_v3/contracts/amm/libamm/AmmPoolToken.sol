// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "./AmmData.sol";
import "../../lib/EIP712.sol";
import "../../lib/MathUint.sol";
import "../../lib/SignatureUtil.sol";


/// @title AmmPoolToken
library AmmPoolToken
{
    using MathUint      for uint;
    using SignatureUtil for bytes32;

    event Approval(address indexed owner, address indexed spender, uint value);
    event Transfer(address indexed from,  address indexed to,      uint value);

    bytes32 public constant PERMIT_TYPEHASH = keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    function approve(
        AmmData.State storage S,
        address               spender,
        uint                  value
        )
        internal
        returns (bool)
    {
        _approve(S, msg.sender, spender, value);
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
        _transfer(S, msg.sender, to, value);
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
        if (msg.sender != address(this) &&
            S.allowance[from][msg.sender] != uint(-1)) {
            S.allowance[from][msg.sender] = S.allowance[from][msg.sender].sub(value);
        }
         _transfer(S, from, to, value);
        return true;
    }

    function permit(
        AmmData.State storage S,
        address               owner,
        address               spender,
        uint256               value,
        uint256               deadline,
        bytes        calldata signature
        )
        internal
    {
        require(deadline >= block.timestamp, 'EXPIRED');

        bytes32 hash = EIP712.hashPacked(
            S.domainSeperator,
            keccak256(
                abi.encodePacked(
                    PERMIT_TYPEHASH,
                    owner,
                    spender,
                    value,
                    S.permitNonces[owner]++,
                    deadline
                )
            )
        );

        require(hash.verifySignature(owner, signature), 'INVALID_SIGNATURE');
        _approve(S, owner, spender, value);
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

    function _approve(
        AmmData.State storage S,
        address               owner,
        address               spender,
        uint                  value
        )
        private
    {
        if (spender != address(this)) {
            S.allowance[owner][spender] = value;
            emit Approval(owner, spender, value);
        }
    }

    function _transfer(
        AmmData.State storage S,
        address               from,
        address               to,
        uint                  value
        )
        private
    {
        S.balanceOf[from] = S.balanceOf[from].sub(value);
        S.balanceOf[to] = S.balanceOf[to].add(value);
        emit Transfer(from, to, value);
    }
}
