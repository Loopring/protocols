// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./IFlashLoanRecipient.sol";
import "./IVault.sol";
import "@openzeppelin/contracts/utils/Address.sol";

interface FlashLoanPoolInterface {
    function flashLoan(
        address token,
        uint256 amount,
        bytes memory userData
    ) external;
}

contract BalancerFlashLoan is IFlashLoanRecipient, FlashLoanPoolInterface {
    address public immutable vault;
    address public constant ethAddr =
        0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    using SafeERC20 for IERC20;

    struct CastData {
        address target;
        IERC20 token;
        bytes data;
        uint256 amount;
    }

    constructor(address _vault) {
        vault = _vault;
    }

    function receiveFlashLoan(
        IERC20[] memory tokens,
        uint256[] memory amounts,
        uint256[] memory /*feeAmounts*/,
        bytes memory userData
    ) external override {
        // check msg.sender
        require(msg.sender == vault);

        for (uint256 i = 0; i < tokens.length; ++i) {
            CastData memory cd;
            cd.token = tokens[i];
            cd.amount = amounts[i];
            (cd.target, cd.data) = abi.decode(userData, (address, bytes));

            if (address(cd.token) == ethAddr) {
                payable(cd.target).transfer(cd.amount);
            } else {
                cd.token.safeTransfer(cd.target, cd.amount);
            }

            // execute from smartwallet
            Address.functionCall(
                cd.target,
                cd.data,
                "flashloan-fallback-failed"
            );

            // Return loan
            if (address(cd.token) == ethAddr) {
                payable(vault).transfer(cd.amount);
            } else {
                cd.token.safeTransfer(vault, cd.amount);
            }
        }
    }

    function flashLoan(
        address token,
        uint256 amount,
        bytes memory data
    ) external {
        IERC20[] memory tokens = new IERC20[](1);
        tokens[0] = IERC20(token);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;
        // including `from` address
        bytes memory userData = abi.encode(msg.sender, data);

        IBalancerVault(vault).flashLoan(
            IFlashLoanRecipient(address(this)),
            tokens,
            amounts,
            userData
        );
    }
}
