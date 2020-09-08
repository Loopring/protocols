// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../lib/MathUint.sol";
import "../security/SecurityModule.sol";


/// @title BaseTransferModule
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang - <daniel@loopring.org>
abstract contract BaseTransferModule is SecurityModule
{
    using MathUint      for uint;

    event Transfered(
        address wallet,
        address token,
        address to,
        uint    amount,
        bytes   logdata
    );
    event Approved(
        address wallet,
        address token,
        address spender,
        uint    amount
    );
    event ContractCalled(
        address wallet,
        address to,
        uint    value,
        bytes   data
    );

    function transferInternal(
        address wallet,
        address token,
        address to,
        uint    amount,
        bytes   calldata logdata
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
        bytes   calldata txData
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
        require(controller().priceOracle().tokenValue(to, 1e18) == 0, "CALL_DISALLOWED");

        returnData = transactCall(wallet, to, value, txData);
        emit ContractCalled(wallet, to, value, txData);
    }

    function isTargetWhitelisted(address wallet, address to)
        internal
        view
        returns (bool res)
    {
        (res,) = controller().whitelistStore().isWhitelisted(wallet, to);
        res = res || controller().dappAddressStore().isDapp(to);
    }
}
