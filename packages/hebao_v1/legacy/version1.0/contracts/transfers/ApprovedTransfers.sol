// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.6.6;
pragma experimental ABIEncoderV2;

import "../../lib/ERC20.sol";

import "./TransferModule.sol";


/// @title ApprovedTransfers
contract ApprovedTransfers is TransferModule
{
    constructor(ControllerImpl _controller)
        public
        TransferModule(_controller) {}

    function transferToken(
        address            wallet,
        address            token,
        address            to,
        uint               amount,
        bytes     calldata logdata
        )
        external
        nonReentrant
        onlyWhenWalletUnlocked(wallet)
        onlyFromMetaTx
    {
        transferInternal(wallet, token, to, amount, logdata);
    }

    function approveToken(
        address            wallet,
        address            token,
        address            to,
        uint               amount
        )
        external
        nonReentrant
        onlyWhenWalletUnlocked(wallet)
        onlyFromMetaTx
    {
        approveInternal(wallet, token, to, amount);
    }

    function callContract(
        address            wallet,
        address            to,
        uint               value,
        bytes     calldata data
        )
        external
        nonReentrant
        onlyWhenWalletUnlocked(wallet)
        onlyFromMetaTx
        returns (bytes memory returnData)
    {
        return callContractInternal(wallet, to, value, data);
    }

    function approveThenCallContract(
        address            wallet,
        address            token,
        address            to,
        uint               amount,
        uint               value,
        bytes     calldata data
        )
        external
        nonReentrant
        onlyWhenWalletUnlocked(wallet)
        onlyFromMetaTx
        returns (bytes memory returnData)
    {
        approveInternal(wallet, token, to, amount);
        return callContractInternal(wallet, to, value, data);
    }

    function verifySigners(
        address   wallet,
        bytes4    method,
        bytes     memory /*data*/,
        address[] memory signers
        )
        internal
        view
        override
        returns (bool)
    {
        require (
            method == this.transferToken.selector ||
            method == this.approveToken.selector ||
            method == this.callContract.selector ||
            method == this.approveThenCallContract.selector,
            "INVALID_METHOD"
        );
        return GuardianUtils.requireMajority(
            controller.securityStore(),
            wallet,
            signers,
            GuardianUtils.SigRequirement.OwnerRequired
        );
    }
}
