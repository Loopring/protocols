// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;
pragma experimental ABIEncoderV2;

import './IFlashLoanRecipient.sol';
import './IVault.sol';
import 'hardhat/console.sol';
import '@openzeppelin/contracts/utils/Address.sol';

interface FlashLoanPoolInterface {
    function flashLoan(
        address token,
        uint256 amount,
        bytes memory userData
    ) external;
}

contract BalancerFlashLoan is
    IFlashLoanRecipient,
    FlashLoanPoolInterface
{
    address public immutable vault;

    constructor(address _vault) {
        vault = _vault;
    }

    function receiveFlashLoan(
        IERC20[] memory tokens,
        uint256[] memory amounts,
        uint256[] memory feeAmounts,
        bytes memory userData
    ) external override {
        // check msg.sender
        require(msg.sender == vault);

        for (uint256 i = 0; i < tokens.length; ++i) {
            IERC20 token = tokens[i];
            uint256 amount = amounts[i];
            console.log('borrowed amount:', amount);
            uint256 feeAmount = feeAmounts[i];
            console.log('flashloan fee: ', feeAmount);

            (address target, bytes memory data) = abi.decode(
                userData,
                (address, bytes)
            );
            // execute from smartwallet
            Address.functionCall(
                target,
                data,
                'flashloan-fallback-failed'
            );

            // Return loan
            token.transfer(vault, amount);
        }
    }

    function flashLoan(
        address token,
        uint256 amount,
        bytes memory data
    ) external {
        IERC20[] memory tokens = new IERC20[](2);
        tokens[0] = IERC20(token);
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = amount;
        // including `from` address
        bytes memory userData = abi.encode(address(this), data);

        IBalancerVault(vault).flashLoan(
            IFlashLoanRecipient(address(this)),
            tokens,
            amounts,
            userData
        );
    }
}
