pragma solidity ^0.4.11;

contract LoopringExchange {

    address public owner;

    function LoopringExchange(address _owner) public {
        owner = _owner;
    }


    function fillRing() public returns (bool) {
        return true;
    }

}
