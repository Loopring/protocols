// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../thirdparty/SafeERC20.sol";
import "../../lib/ERC20.sol";
import "../../lib/MathUint.sol";
import "../../lib/AddressUtil.sol";
import "../../iface/PriceOracle.sol";
import "./WhitelistLib.sol";
import "./QuotaLib.sol";
import "./ApprovalLib.sol";


/// @title ERC20Lib
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang - <daniel@loopring.org>
library ERC20Lib
{
    using AddressUtil   for address;
    using MathUint      for uint;
    using WhitelistLib  for Wallet;
    using QuotaLib      for Wallet;
    using ApprovalLib   for Wallet;
    using SafeERC20     for ERC20;

    event Transfered     (address token, address to,      uint amount, bytes logdata);
    event Approved       (address token, address spender, uint amount);
    event ContractCalled (address to,    uint    value,   bytes data);

    bytes32 public constant TRANSFER_TOKEN_TYPEHASH = keccak256(
        "transferToken(address wallet,uint256 validUntil,address token,address to,uint256 amount,bytes logdata)"
    );
    bytes32 public constant APPROVE_TOKEN_TYPEHASH = keccak256(
        "approveToken(address wallet,uint256 validUntil,address token,address to,uint256 amount)"
    );
    bytes32 public constant CALL_CONTRACT_TYPEHASH = keccak256(
        "callContract(address wallet,uint256 validUntil,address to,uint256 value,bytes data)"
    );
    bytes32 public constant APPROVE_THEN_CALL_CONTRACT_TYPEHASH = keccak256(
        "approveThenCallContract(address wallet,uint256 validUntil,address token,address to,uint256 amount,uint256 value,bytes data)"
    );

    function transferToken(
        Wallet storage wallet,
        PriceOracle    priceOracle,
        address        token,
        address        to,
        uint           amount,
        bytes calldata logdata,
        bool           forceUseQuota
        )
        external
    {
        if (forceUseQuota || !wallet.isAddressWhitelisted(to)) {
            wallet.checkAndAddToSpent(priceOracle, token, amount);
        }
        _transferWithEvent(token, to, amount, logdata);
    }

    function transferTokenWA(
        Wallet   storage  wallet,
        bytes32           domainSeparator,
        Approval calldata approval,
        address           token,
        address           to,
        uint              amount,
        bytes    calldata logdata
        )
        external
        returns (bytes32 approvedHash)
    {
        approvedHash = wallet.verifyApproval(
            domainSeparator,
            SigRequirement.MAJORITY_OWNER_REQUIRED,
            approval,
            abi.encode(
                TRANSFER_TOKEN_TYPEHASH,
                approval.wallet,
                approval.validUntil,
                token,
                to,
                amount,
                keccak256(logdata)
            )
        );

        _transferWithEvent(token, to, amount, logdata);
    }

    function callContract(
        Wallet  storage  wallet,
        PriceOracle      priceOracle,
        address          to,
        uint             value,
        bytes   calldata data,
        bool             forceUseQuota
        )
        external
        returns (bytes memory returnData)
    {
        if (forceUseQuota || !wallet.isAddressWhitelisted(to)) {
            wallet.checkAndAddToSpent(priceOracle, address(0), value);
        }

        return _callContractInternal(to, value, data, priceOracle);
    }

    function callContractWA(
        Wallet   storage  wallet,
        bytes32           domainSeparator,
        Approval calldata approval,
        address           to,
        uint              value,
        bytes    calldata data
        )
        external
        returns (bytes32 approvedHash, bytes memory returnData)
    {
        approvedHash = wallet.verifyApproval(
            domainSeparator,
            SigRequirement.MAJORITY_OWNER_REQUIRED,
            approval,
            abi.encode(
                CALL_CONTRACT_TYPEHASH,
                approval.wallet,
                approval.validUntil,
                to,
                value,
                keccak256(data)
            )
        );

        returnData = _callContractInternal(to, value, data, PriceOracle(0));
    }

    function approveToken(
        Wallet      storage wallet,
        PriceOracle         priceOracle,
        address             token,
        address             to,
        uint                amount,
        bool                forceUseQuota
        )
        external
    {
        uint additionalAllowance = _approveInternal(token, to, amount);

        if (forceUseQuota || !wallet.isAddressWhitelisted(to)) {
            wallet.checkAndAddToSpent(priceOracle, token, additionalAllowance);
        }
    }

    function approveTokenWA(
        Wallet   storage  wallet,
        bytes32           domainSeparator,
        Approval calldata approval,
        address           token,
        address           to,
        uint              amount
        )
        external
        returns (bytes32 approvedHash)
    {
        approvedHash = wallet.verifyApproval(
            domainSeparator,
            SigRequirement.MAJORITY_OWNER_REQUIRED,
            approval,
            abi.encode(
                APPROVE_TOKEN_TYPEHASH,
                approval.wallet,
                approval.validUntil,
                token,
                to,
                amount
            )
        );

        _approveInternal(token, to, amount);
    }

    function approveThenCallContract(
        Wallet  storage  wallet,
        PriceOracle      priceOracle,
        address          token,
        address          to,
        uint             amount,
        uint             value,
        bytes   calldata data,
        bool             forceUseQuota
        )
        external
        returns (bytes memory returnData)
    {
        uint additionalAllowance = _approveInternal(token, to, amount);

        if (forceUseQuota || !wallet.isAddressWhitelisted(to)) {
            wallet.checkAndAddToSpent(priceOracle, token, additionalAllowance);
            wallet.checkAndAddToSpent(priceOracle, address(0), value);
        }

        return _callContractInternal(to, value, data, priceOracle);
    }

    function approveThenCallContractWA(
        Wallet   storage  wallet,
        bytes32           domainSeparator,
        Approval calldata approval,
        address           token,
        address           to,
        uint              amount,
        uint              value,
        bytes    calldata data
        )
        external
        returns (bytes32 approvedHash, bytes memory returnData)
    {
        approvedHash = wallet.verifyApproval(
            domainSeparator,
            SigRequirement.MAJORITY_OWNER_REQUIRED,
            approval,
            abi.encode(
                APPROVE_THEN_CALL_CONTRACT_TYPEHASH,
                approval.wallet,
                approval.validUntil,
                token,
                to,
                amount,
                value,
                keccak256(data)
            )
        );

        _approveInternal(token, to, amount);
        returnData = _callContractInternal(to, value, data, PriceOracle(0));
    }

    function transfer(
        address token,
        address to,
        uint    amount
        )
        public
    {
        if (token == address(0)) {
            to.sendETHAndVerify(amount, gasleft());
        } else {
            ERC20(token).safeTransfer(to, amount);
        }
    }

    // --- Internal functions ---

    function _transferWithEvent(
        address token,
        address to,
        uint    amount,
        bytes   calldata logdata
        )
        private
    {
        transfer(token, to, amount);
        emit Transfered(token, to, amount, logdata);
    }

    function _approveInternal(
        address token,
        address spender,
        uint    amount
        )
        private
        returns (uint additionalAllowance)
    {
        // Current allowance
        uint allowance = ERC20(token).allowance(address(this), spender);

        if (amount != allowance) {
            // First reset the approved amount if needed
            if (allowance > 0) {
                ERC20(token).safeApprove(spender, 0);
            }
            // Now approve the requested amount
            ERC20(token).safeApprove(spender, amount);
        }

        // If we increased the allowance, calculate by how much
        if (amount > allowance) {
            additionalAllowance = amount.sub(allowance);
        }
        emit Approved(token, spender, amount);
    }

    function _callContractInternal(
        address              to,
        uint                 value,
        bytes       calldata txData,
        PriceOracle          priceOracle
        )
        private
        returns (bytes memory returnData)
    {
        require(to != address(this), "SELF_CALL_DISALLOWED");

        if (priceOracle != PriceOracle(0)) {
            // Disallow general calls to token contracts (for tokens that have price data
            // so the quota is actually used).
            require(priceOracle.tokenValue(to, 1e18) == 0, "CALL_DISALLOWED");
        }

        bool success;
        (success, returnData) = to.call{value: value}(txData);
        require(success, "CALL_FAILED");

        emit ContractCalled(to, value, txData);
    }
}
