pragma solidity ^0.4.11;

import "zeppelin-solidity/contracts/ownership/Ownable.sol";

contract TokenRegistry is Ownable {

    address[] public tokenAddresses;

    function registerToken(address _token) public onlyOwner {
        tokenAddresses.push(_token);
    }

    function unregisterToken(address _token) public onlyOwner {
        for (uint i = 0; i < tokenAddresses.length; i++) {
            if (tokenAddresses[i] == _token) {
                tokenAddresses[i] == tokenAddresses[tokenAddresses.length - 1];
                tokenAddresses.length -= 1;
            }
        }
    }

    function isTokenRegistered(address _token) public constant returns (bool) {
        for (uint i = 0; i < tokenAddresses.length; i++) {
            if (tokenAddresses[i] == _token)
                return true;
        }
        return false;
    }
}
