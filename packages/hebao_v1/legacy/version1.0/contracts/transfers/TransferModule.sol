// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.6.6;
pragma experimental ABIEncoderV2;

import "../security/SecurityModule.sol";


/// @title TransferModule
abstract contract TransferModule is SecurityModule
{
    event Transfered(
        address indexed wallet,
        address indexed token,
        address indexed to,
        uint            amount,
        bytes           logdata
    );
    event Approved(
        address indexed wallet,
        address indexed token,
        address         spender,
        uint            amount
    );
    event ContractCalled(
        address indexed wallet,
        address indexed to,
        uint            value,
        bytes           data
    );

    constructor(ControllerImpl _controller)
        public
        SecurityModule(_controller) {}

    function transferInternal(
        address wallet,
        address token,
        address to,
        uint    amount,
        bytes   memory logdata
        )
        internal
    {
        if (token == address(0)) {
            transactCall(wallet, to, amount, "");
        } else {
            require(
                transactTokenTransfer(wallet, token, to, amount),
                "TRANSFER_FAILED"
            );
        }
        emit Transfered(wallet, token, to, amount, logdata);
    }

    function approveInternal(
        address wallet,
        address token,
        address spender,
        uint    amount
        )
        internal
        returns (uint additionalAllowance)
    {
        require(token != address(0), "UNSUPPORTED");

        // Current allowance
        uint allowance = ERC20(token).allowance(wallet, spender);

        if (amount != allowance) {
            // First reset the approved amount if needed
            if (allowance > 0) {
                require(
                    transactTokenApprove(wallet, token, spender, 0),
                    "APPROVAL_FAILED"
                );
            }

            // Now approve the requested amount
            require(
                transactTokenApprove(wallet, token, spender, amount),
                "APPROVAL_FAILED"
            );
        }

        // If we increased the allowance, calculate by how much
        if (amount > allowance) {
            additionalAllowance = amount.sub(allowance);
        }
        emit Approved(wallet, token, spender, amount);
    }

    function callContractInternal(
        address wallet,
        address to,
        uint    value,
        bytes   memory txData
        )
        internal
        virtual
        returns (bytes memory returnData)
    {
        // Calls from the wallet to itself are deemed special
        // (e.g. this is used for updating the wallet implementation)
        // We also disallow calls to module functions directly
        // (e.g. this is used for some special wallet <-> module interaction)
        require(wallet != to && !Wallet(wallet).hasModule(to), "CALL_DISALLOWED");
        returnData = transactCall(wallet, to, value, txData);
        emit ContractCalled(wallet, to, value, txData);
    }
}
