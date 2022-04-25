// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

contract MockedThirdpartyContract {

    uint public value;

    function deposit(uint _value) payable external {
        value = _value;
    }

    function withdraw(uint _value) external {
        value = _value;
    }
}
