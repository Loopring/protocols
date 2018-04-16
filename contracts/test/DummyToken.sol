pragma solidity 0.4.21;

import "../lib/ERC20Token.sol";
import "../lib/MathUint.sol";

/// @author Kongliang Zhong - <kongliang@loopring.org>
contract DummyToken is ERC20Token {
    using MathUint for uint;

    /// constructor.
    function DummyToken(
        string _name,
        string _symbol,
        uint8  _decimals,
        uint   _totalSupply
    ) ERC20Token(
        _name,
        _symbol,
        _decimals,
        _totalSupply,
        msg.sender
    )
        public
    {
    }

    function setBalance(
        address _target,
        uint _value
        )
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
