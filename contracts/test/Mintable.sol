pragma solidity ^0.4.11;

import "./../base/SafeMath.sol";
import "./../base/StandardToken.sol";

contract Mintable is SafeMath, StandardToken {
    function mint(uint _value) {
        require(_value <= 10 ** 20);
        balances[msg.sender] = safeAdd(_value, balances[msg.sender]);
        totalSupply = safeAdd(totalSupply, _value);
    }
}
