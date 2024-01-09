// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;
pragma experimental ABIEncoderV2;

import './IFlashLoanRecipient.sol';
import './IVault.sol';
import 'hardhat/console.sol';
import '@openzeppelin/contracts/utils/Address.sol';

contract BalancerFlashLoan is IFlashLoanRecipient {
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

            // do sth here
            Address.functionCall(
                address(this),
                userData,
                'flashloan-fallback-failed'
            );

            // Return loan
            token.transfer(vault, amount);
        }
    }

    function flashLoan(
        IERC20[] memory tokens,
        uint256[] memory amounts,
        bytes memory userData
    ) external {
        IBalancerVault(vault).flashLoan(
            IFlashLoanRecipient(address(this)),
            tokens,
            amounts,
            userData
        );
    }
}
