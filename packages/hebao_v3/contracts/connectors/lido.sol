// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;
pragma experimental ABIEncoderV2;

import './base_connector.sol';

interface ILido {
    function submit(
        address _referral
    ) external payable returns (uint256);
}

/**
 * @title Stake Ether.
 * @dev Stake ETH and receive stETH while staking.
 */

contract LidoConnector is BaseConnector {
    ILido internal constant lidoInterface =
        ILido(0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84);

    address internal constant treasury =
        0x28849D2b63fA8D361e5fc15cB8aBB13019884d09; // Instadapp's treasury address
    constructor(address _instaMemory) BaseConnector(_instaMemory) {}
    /**
     * @dev deposit ETH into Lido.
     * @notice stake Eth in Lido, users receive stETH tokens on a 1:1 basis representing their staked ETH.
     * @param amt The amount of ETH to deposit. (For max: `uint256(-1)`)
     * @param getId ID to retrieve amt.
     * @param setId ID stores the amount of ETH deposited.
     */
    function deposit(
        uint256 amt,
        uint256 getId,
        uint256 setId
    ) public payable {
        uint256 _amt = getUint(getId, amt);

        _amt = _amt == type(uint256).max
            ? address(this).balance
            : _amt;
        lidoInterface.submit{value: amt}(treasury);
        setUint(setId, _amt);
    }
}
