// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./IFlashLoanRecipient.sol";
import "./IVault.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "../../lib/LoopringErrors.sol";

interface FlashLoanPoolInterface {
    function flashLoan(
        address token,
        uint256 amount,
        bytes memory userData
    ) external;
}

contract BalancerFlashLoan is IFlashLoanRecipient, FlashLoanPoolInterface {
    address public immutable vault;

    using SafeERC20 for IERC20;

    struct CastData {
        address target;
        IERC20 token;
        bytes data;
        uint256 amount;
    }

    constructor(address _vault) {
        _require(_vault != address(0), Errors.ZERO_ADDRESS);
        vault = _vault;
    }

    function receiveFlashLoan(
        IERC20[] memory tokens,
        uint256[] memory amounts,
        uint256[] memory /*feeAmounts*/,
        bytes memory userData
    ) external override {
        // check msg.sender
        _require(msg.sender == vault, Errors.NOT_FROM_BALANCER_VAULT);

        for (uint256 i = 0; i < tokens.length; ++i) {
            CastData memory cd;
            cd.token = tokens[i];
            _require(address(cd.token) != address(0), Errors.ZERO_TOKEN);
            cd.amount = amounts[i];
            (cd.target, cd.data) = abi.decode(userData, (address, bytes));

            cd.token.safeTransfer(cd.target, cd.amount);

            // execute from smartwallet
            Address.functionCall(
                cd.target,
                cd.data,
                "flashloan-fallback-failed"
            );

            // Return loan
            cd.token.safeTransfer(vault, cd.amount);
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
