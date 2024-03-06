// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;

import "./base_connector.sol";

contract WETHConnector is BaseConnector {
    TokenInterface internal constant WETH_CONTRACT =
        TokenInterface(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    constructor(address _instaMemory) BaseConnector(_instaMemory) {}

    function deposit(uint256 amt, uint256 getId, uint256 setId) public payable {
        uint _amt = getUint(getId, amt);
        _amt = _amt == type(uint256).max ? address(this).balance : _amt;
        WETH_CONTRACT.deposit{value: _amt}();
        setUint(setId, _amt);
    }

    function withdraw(uint amt, uint getId, uint setId) public payable {
        uint _amt = getUint(getId, amt);

        _amt = _amt == type(uint256).max
            ? WETH_CONTRACT.balanceOf(address(this))
            : _amt;
        WETH_CONTRACT.withdraw(_amt);
        setUint(setId, _amt);
    }
}
