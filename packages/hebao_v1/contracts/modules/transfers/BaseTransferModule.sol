// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.6.10;
pragma experimental ABIEncoderV2;

import "../security/SecurityModule.sol";


/// @title BaseTransferModule
abstract contract BaseTransferModule is SecurityModule
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

    constructor(
        ControllerImpl _controller,
        address        _trustedForwarder
        )
        public
        SecurityModule(_controller, _trustedForwarder)
    {
    }

    function transferInternal(
        address wallet,
        address token,
        address to,
        uint    amount,
        bytes   memory logdata
        )
        internal
    {
        transactTokenTransfer(wallet, token, to, amount);
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
        // Current allowance
        uint allowance = ERC20(token).allowance(wallet, spender);

        if (amount != allowance) {
            // First reset the approved amount if needed
            if (allowance > 0) {
                transactTokenApprove(wallet, token, spender, 0);
            }

            // Now approve the requested amount
            transactTokenApprove(wallet, token, spender, amount);
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

        // Disallow general calls to token contracts (for tokens that have price data
        // so the quota is actually used).
        require(controller.priceOracle().tokenValue(to, 1e18) == 0, "CALL_DISALLOWED");

        returnData = transactCall(wallet, to, value, txData);
        emit ContractCalled(wallet, to, value, txData);
    }

    function isTargetWhitelisted(address wallet, address to)
        internal
        view
        returns (bool res)
    {
        (res,) = controller.whitelistStore().isWhitelisted(wallet, to);
        res = res || controller.dappAddressStore().isDapp(to);
    }
}
