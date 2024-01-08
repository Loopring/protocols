// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;
pragma experimental ABIEncoderV2;

import './base_connector.sol';

interface ETHInterface {
    function approve(address, uint256) external;
    function transfer(address, uint) external;
    function transferFrom(address, address, uint) external;
    function deposit() external payable;
    function withdraw(uint) external;
    function balanceOf(address) external view returns (uint);
    function decimals() external view returns (uint);
}

contract WETHConnector is BaseConnector {
    ETHInterface internal constant wethContract =
        ETHInterface(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);

    function deposit(
        uint256 amt,
        uint256 getId,
        uint256 setId
    ) public payable {
        uint _amt = getUint(getId, amt);
        _amt = _amt == type(uint256).max
            ? address(this).balance
            : _amt;
        wethContract.deposit{value: _amt}();
        setUint(setId, _amt);
    }

    function withdraw(
        uint amt,
        uint getId,
        uint setId
    ) public payable {
        uint _amt = getUint(getId, amt);

        _amt = _amt == type(uint256).max
            ? wethContract.balanceOf(address(this))
            : _amt;
        wethContract.approve(wethAddr, _amt);
        wethContract.withdraw(_amt);
        setUint(setId, _amt);
    }
}
