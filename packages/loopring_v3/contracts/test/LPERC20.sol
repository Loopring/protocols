// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import '../lib/ERC20.sol';
import '../lib/MathUint.sol';

contract LPERC20 is ERC20 {
    using MathUint for uint;

    string public constant name = 'Loopring AMM';
    string public constant symbol = 'LLT';
    uint8 public constant decimals = 18;
    uint  public _totalSupply;
    mapping(address => uint) public _balanceOf;
    mapping(address => mapping(address => uint)) public _allowance;

    event Approval(address indexed owner, address indexed spender, uint value);
    event Transfer(address indexed from, address indexed to, uint value);

    function totalSupply() public virtual view override returns (uint) {
        return _totalSupply;
    }

    function balanceOf(address owner) public view override virtual returns (uint balance) {
        return _balanceOf[owner];
    }

    function allowance(address owner, address spender) public view override returns (uint) {
        return _allowance[owner][spender];
    }

    function approve(address spender, uint value) public override returns (bool) {
        _approve(msg.sender, spender, value);
        return true;
    }

    function transfer(address to, uint value) public override returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function transferFrom(address from, address to, uint value) public override returns (bool) {
        if (_allowance[from][msg.sender] != uint(-1)) {
            _allowance[from][msg.sender] = _allowance[from][msg.sender].sub(value);
        }
        _transfer(from, to, value);
        return true;
    }

    function _mint(address to, uint value) internal {
        _totalSupply = _totalSupply.add(value);
        _balanceOf[to] = _balanceOf[to].add(value);
        emit Transfer(address(0), to, value);
    }

    function _burn(address from, uint value) internal {
        _balanceOf[from] = _balanceOf[from].sub(value);
        _totalSupply = _totalSupply.sub(value);
        emit Transfer(from, address(0), value);
    }

    function _approve(address owner, address spender, uint value) private {
        _allowance[owner][spender] = value;
        emit Approval(owner, spender, value);
    }

    function _transfer(address from, address to, uint value) private {
        _balanceOf[from] = _balanceOf[from].sub(value);
        _balanceOf[to] = _balanceOf[to].add(value);
        emit Transfer(from, to, value);
    }
}
