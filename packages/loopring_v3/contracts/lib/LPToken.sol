// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import './ERC20.sol';
import './MathUint.sol';
import './SignatureUtil.sol';
import './EIP712.sol';


contract LPToken is ERC20
{
    using MathUint      for uint;
    using SignatureUtil for bytes32;

    bytes32 public DOMAIN_SEPARATOR;
    string  public name;
    string  public symbol;
    uint8   public decimals;

    uint                                         public override totalSupply;
    mapping(address => uint)                     public override balanceOf;
    mapping(address => mapping(address => uint)) public override allowance;
    mapping(address => uint)                     public nonces;

    event Approval(address indexed owner, address indexed spender, uint value);
    event Transfer(address indexed from,  address indexed to,      uint value);

    bytes32 public constant PERMIT_TYPEHASH = keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    function initializeToken(
        string memory _name,
        string memory _symbol,
        uint8         _decimals
        )
        internal
    {
        DOMAIN_SEPARATOR = EIP712.hash(EIP712.Domain(
            _name,
            "1.0",
            address(this)
        ));

        name = _name;
        symbol = _symbol;
        decimals = _decimals;
    }

    function approve(
        address spender,
        uint    value
        )
        external
        override
        returns (bool)
    {
        _approve(msg.sender, spender, value);
        return true;
    }

    function transfer(
        address to,
        uint    value
        )
        external
        override
        returns (bool)
    {
        _transfer(msg.sender, to, value);
        return true;
    }

    function transferFrom(
        address from,
        address to,
        uint    value
        )
        external
        override
        returns (bool)
    {
        if (msg.sender != address(this) &&
            allowance[from][msg.sender] != type(uint256).max) {
            allowance[from][msg.sender] = allowance[from][msg.sender].sub(value);
        }
         _transfer(from, to, value);
        return true;
    }

    function _mint(
        address to,
        uint    value
        )
        internal
    {
        totalSupply = totalSupply.add(value);
        balanceOf[to] = balanceOf[to].add(value);
        emit Transfer(address(0), to, value);
    }

    function _burn(
        address from,
        uint    value
        )
        internal
    {
        balanceOf[from] = balanceOf[from].sub(value);
        totalSupply = totalSupply.sub(value);
        emit Transfer(from, address(0), value);
    }

    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        bytes   calldata signature
        )
        external
    {
        require(deadline >= block.timestamp, 'EXPIRED');

        bytes32 hash = EIP712.hashPacked(
            DOMAIN_SEPARATOR,
            keccak256(
                abi.encode(
                    PERMIT_TYPEHASH,
                    owner,
                    spender,
                    value,
                    nonces[owner]++,
                    deadline
                )
            )
        );

        require(hash.verifySignature(owner, signature), 'INVALID_SIGNATURE');
        _approve(owner, spender, value);
    }

    function _approve(
        address owner,
        address spender,
        uint    value
        )
        private
    {
        if (spender != address(this)) {
            allowance[owner][spender] = value;
            emit Approval(owner, spender, value);
        }
    }

    function _transfer(
        address from,
        address to,
        uint    value
        )
        private
    {
        balanceOf[from] = balanceOf[from].sub(value);
        balanceOf[to] = balanceOf[to].add(value);
        emit Transfer(from, to, value);
    }
}
