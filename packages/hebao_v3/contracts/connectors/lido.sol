// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {Address} from "@openzeppelin/contracts/utils/Address.sol";

import "./base_connector.sol";

interface ILido {
    function submit(address _referral) external payable returns (uint256);
}

interface IWstETH {
    function wrap(uint256 _stETHAmount) external returns (uint256);
    function unwrap(uint256 _wstETHAmount) external returns (uint256);
}

/**
 * @title Stake Ether.
 * @dev Stake ETH and receive stETH while staking.
 */

contract LidoConnector is BaseConnector {
    using SafeERC20 for IERC20;

    ILido internal constant LIDO =
        ILido(0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84);

    IWstETH internal constant WSTETH =
        IWstETH(0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0);

    address internal constant TREASURY =
        0x28849D2b63fA8D361e5fc15cB8aBB13019884d09; // Instadapp's treasury address
    constructor(address _instaMemory) BaseConnector(_instaMemory) {}
    /**
     * @dev deposit ETH into Lido.
     * @notice stake Eth in Lido, users receive stETH tokens on a 1:1 basis representing their staked ETH.
     * @param amt The amount of ETH to deposit. (For max: `uint256(-1)`)
     * @param getId ID to retrieve amt.
     * @param setId ID stores the amount of ETH deposited.
     */
    function deposit(uint256 amt, uint256 getId, uint256 setId) public payable {
        uint256 _amt = getUint(getId, amt);

        _amt = _amt == type(uint256).max ? address(this).balance : _amt;
        LIDO.submit{value: amt}(TREASURY);
        setUint(setId, _amt);
    }

    // staking eth to receive sthETH and wrap it to wstETH
    function wrapAndStaking(
        uint256 amt,
        uint256 getId,
        uint256 setId
    ) public payable {
        uint256 _amt = getUint(getId, amt);
        _amt = _amt == type(uint256).max ? address(this).balance : _amt;
        Address.sendValue(payable(address(WSTETH)), _amt);
        setUint(setId, _amt);
    }

    // can only get stETH rather than ETH
    function unwrap(uint256 amt, uint256 getId, uint256 setId) public {
        uint256 _amt = getUint(getId, amt);

        TokenInterface tokenContract = TokenInterface(address(WSTETH));
        _amt = _amt == type(uint256).max
            ? tokenContract.balanceOf(address(this))
            : _amt;

        WSTETH.unwrap(_amt);

        setUint(setId, _amt);
    }
}
