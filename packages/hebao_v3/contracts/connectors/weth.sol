// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;

import "./base_connector.sol";

contract WETHConnector is BaseConnector {
    constructor(
        address _instaMemory,
        address _weth
    ) BaseConnector(_instaMemory, _weth) {}

    function deposit(uint256 amt, uint256 getId, uint256 setId) public payable {
        uint _amt = getUint(getId, amt);
        _amt = _amt == type(uint256).max ? address(this).balance : _amt;
        TokenInterface(WETH_ADDR).deposit{value: _amt}();
        setUint(setId, _amt);
    }

    function withdraw(uint amt, uint getId, uint setId) public payable {
        uint _amt = getUint(getId, amt);

        _amt = _amt == type(uint256).max
            ? TokenInterface(WETH_ADDR).balanceOf(address(this))
            : _amt;
        TokenInterface(WETH_ADDR).withdraw(_amt);
        setUint(setId, _amt);
    }
}
