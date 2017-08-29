pragma solidity ^0.4.11;

import "zeppelin-solidity/contracts/token/MintableToken.sol";

contract DummyToken is MintableToken {
    string public name;
    string public symbol;
    uint public decimals;

    function DummyToken(
        string _name,
        string _symbol,
        uint _decimals,
        uint _totalSupply)
    {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
        totalSupply = _totalSupply;
        balances[msg.sender] = _totalSupply;
    }

    function setBalance(address _target, uint _value) onlyOwner {
        uint currBalance = balanceOf(_target);
        if (_value < currBalance) {
            totalSupply = totalSupply.sub(currBalance.sub(_value));
        } else {
            totalSupply = totalSupply.add(_value.sub(currBalance));
        }
        balances[_target] = _value;
    }
}
