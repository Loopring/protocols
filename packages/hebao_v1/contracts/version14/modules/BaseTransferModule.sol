// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../lib/EIP712.sol";
import "../../lib/MathUint.sol";
import "../../base/WalletDataLayout.sol";
import "../data/GuardianData.sol";
import "../data/OracleData.sol";
import "../data/QuotaData.sol";
import "../data/SecurityData.sol";
import "./SecurityModule.sol";


/// @title BaseTransferModule
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang - <daniel@loopring.org>
abstract contract BaseTransferModule is SecurityModule
{
    using OracleData    for WalletDataLayout.State;
    using QuotaData     for WalletDataLayout.State;
    using MathUint      for uint;
    using BytesUtil     for bytes;

    event Transfered    (address token, address to,      uint amount, bytes logdata);
    event Approved      (address token, address spender, uint amount);
    event ContractCalled(address to,    uint    value,   bytes data);

    function _transferToken(
        address token,
        address to,
        uint    amount,
        bytes   calldata logdata
        )
        internal
    {
        _transferTokenInternal(token, to, amount);
        emit Transfered(token, to, amount, logdata);
    }

    function _approveToken(
        address token,
        address spender,
        uint    amount
        )
        internal
        returns (uint additionalAllowance)
    {
        // Current allowance
        uint allowance = ERC20(token).allowance(address(this), spender);

        if (amount != allowance) {
            // First reset the approved amount if needed
            if (allowance > 0) {
                _approveTokenInternal(token, spender, 0);
            }

            // Now approve the requested amount
            _approveTokenInternal(token, spender, amount);
        }

        // If we increased the allowance, calculate by how much
        if (amount > allowance) {
            additionalAllowance = amount.sub(allowance);
        }
        emit Approved(token, spender, amount);
    }

    function _callContract(
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
        require(address(this) != to, "NOT_ALOOWED");

        // Disallow general calls to token contracts (for tokens that have price data
        // so the quota is actually used).
        require(state.priceOracle().tokenValue(to, 1e18) == 0, "PROHOBITED");

        returnData = transact(uint8(1), to, value, txData);
        emit ContractCalled(to, value, txData);
    }

    // Special case for transactCall to support transfers on "bad" ERC20 tokens
    function _transferTokenInternal(
        address token,
        address to,
        uint    amount
        )
        private
    {
        if (token == address(0)) {
            transact(uint8(1), to, amount, "");
            return;
        }

        bytes memory txData = abi.encodeWithSelector(ERC20.transfer.selector, to, amount);
        bytes memory returnData = transact(uint8(1), token, 0, txData);
        // `transactCall` will revert if the call was unsuccessful.
        // The only extra check we have to do is verify if the return value (if there is any) is correct.
        bool success = returnData.length == 0 ? true :  abi.decode(returnData, (bool));
        require(success, "ERC20_TRANSFER_FAILED");
    }

    // Special case for transactCall to support approvals on "bad" ERC20 tokens
    function _approveTokenInternal(
        address token,
        address spender,
        uint    amount
        )
        private
    {
        require(token != address(0), "INVALID_TOKEN");
        bytes memory txData = abi.encodeWithSelector(
            ERC20.approve.selector,
            spender,
            amount
        );
        bytes memory returnData = transact(uint8(1), token, 0, txData);
        // `transactCall` will revert if the call was unsuccessful.
        // The only extra check we have to do is verify if the return value (if there is any) is correct.
        bool success = returnData.length == 0 ? true :  abi.decode(returnData, (bool));
        require(success, "ERC20_APPROVE_FAILED");
    }
}
