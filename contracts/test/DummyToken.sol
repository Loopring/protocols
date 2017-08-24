pragma solidity ^0.4.11;

import "./../base/Ownable.sol";
import "./Mintable.sol";

contract DummyToken is Ownable, Mintable {
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
            totalSupply = safeSub(totalSupply, safeSub(currBalance, _value));
        } else {
            totalSupply = safeAdd(totalSupply, safeSub(_value, currBalance));
        }
        balances[_target] = _value;
    }
}
