// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;
pragma experimental ABIEncoderV2;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../base_connector.sol";
import {FlashLoanPoolInterface} from "./BalancerFlashloan.sol";

interface ApprovalInterface {
    function approveExecutor(address executor, uint256 validUntil) external;

    function unApproveExecutor(address executor) external;
}

contract FlashLoanConnector is BaseConnector {
    using SafeERC20 for IERC20;

    FlashLoanPoolInterface immutable flashLoanPool;

    constructor(
        address _instaMemory,
        address _flashLoanPool
    ) BaseConnector(_instaMemory) {
        flashLoanPool = FlashLoanPoolInterface(_flashLoanPool);
    }

    /**
     * @dev Borrow Flashloan and Cast spells.
     * @param token Token Address.
     * @param amt Token Amount.
     * @param data targets & data for cast.
     */
    function flashBorrowAndCast(
        address token,
        uint amt,
        bytes memory data
    ) external payable {
        (address[] memory targets, bytes[] memory callDatas) = abi.decode(
            data,
            (address[], bytes[])
        );
        ApprovalInterface(address(this)).approveExecutor(
            address(flashLoanPool),
            type(uint256).max
        );

        bytes memory callData = abi.encodeWithSignature(
            "castFromExecutor(address[],bytes[])",
            targets,
            callDatas
        );

        flashLoanPool.flashLoan(token, amt, callData);

        ApprovalInterface(address(this)).unApproveExecutor(
            address(flashLoanPool)
        );
    }

    /**
     * @dev Return token to InstaPool.
     * @param token Token Address.
     * @param amt Token Amount.
     * @param getId Get token amount at this ID from `InstaMemory` Contract.
     * @param setId Set token amount at this ID in `InstaMemory` Contract.
     */
    function flashPayback(
        address token,
        uint amt,
        uint getId,
        uint setId
    ) external payable {
        uint _amt = getUint(getId, amt);

        IERC20 tokenContract = IERC20(token);

        if (token == ethAddr) {
            Address.sendValue(payable(address(flashLoanPool)), _amt);
        } else {
            tokenContract.safeTransfer(address(flashLoanPool), _amt);
        }

        setUint(setId, _amt);
    }
}
