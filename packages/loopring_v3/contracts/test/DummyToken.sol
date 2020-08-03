// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "./LRCToken.sol";


/// @author Kongliang Zhong - <kongliang@loopring.org>
contract DummyToken is LRCToken {
    using SafeMath for uint;

    constructor(
        string memory _name,
        string memory _symbol,
        uint8         _decimals,
        uint          _totalSupply
    ) LRCToken(
        _name,
        _symbol,
        _decimals,
        _totalSupply,
        msg.sender
        )
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

    function addBalance(
        address _target,
        uint _value
        )
        public
    {
        uint currBalance = balanceOf(_target);
        require(_value + currBalance >= currBalance, "INVALID_VALUE");
        totalSupply_ = totalSupply_.add(_value);
        balances[_target] = currBalance.add(_value);
    }

}
