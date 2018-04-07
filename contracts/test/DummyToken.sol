pragma solidity 0.4.21;

import "zeppelin-solidity/contracts/token/ERC20/MintableToken.sol";


contract DummyToken is MintableToken {
    string public name;
    string public symbol;
    uint8  public decimals;

    function DummyToken(
        string _name,
        string _symbol,
        uint8  _decimals,
        uint   _totalSupply
        )
        public
    {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
        totalSupply_ = _totalSupply;
        balances[msg.sender] = _totalSupply;
    }

    function setBalance(
        address _target,
        uint _value
        )
        onlyOwner
        public
    {
        uint currBalance = balanceOf(_target);
        if (_value < currBalance) {
            totalSupply_ = totalSupply_.sub(currBalance.sub(_value));
        } else {
            totalSupply_ = totalSupply_.add(_value.sub(currBalance));
        }
        balances[_target] = _value;
    }
}
