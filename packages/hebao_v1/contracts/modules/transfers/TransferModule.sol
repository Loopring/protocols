// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../lib/MathUint.sol";
import "../security/SecurityModule.sol";
import "../security/SignedRequest.sol";
import "./BaseTransferModule.sol";


/// @title TransferModule
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang - <daniel@loopring.org>
abstract contract TransferModule is BaseTransferModule
{
    using MathUint      for uint;
    using SignedRequest for ControllerImpl;

    bytes32 public TRANSFER_DOMAIN_SEPERATOR;

    uint public constant QUOTA_PENDING_PERIOD = 1 days;

    bytes32 public constant CHANGE_DAILY_QUOTE_TYPEHASH = keccak256(
        "changeDailyQuota(address wallet,uint256 validUntil,uint256 newQuota)"
    );

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


    constructor()
    {
        TRANSFER_DOMAIN_SEPERATOR = EIP712.hash(
            EIP712.Domain("TransferModule", "1.2.0", address(this))
        );
    }

    function changeDailyQuota(
        address wallet,
        uint    newQuota
        )
        external
        txAwareHashNotAllowed()
        onlyFromWalletOrOwnerWhenUnlocked(wallet)
    {
        QuotaStore qs = controllerCache.quotaStore;
        uint _newQuota = newQuota == 0 ? qs.defaultQuota(): newQuota;
        uint _currentQuota = qs.currentQuota(wallet);

        if (_currentQuota >= _newQuota) {
            qs.changeQuota(wallet, _newQuota, block.timestamp);
        } else {
            qs.changeQuota(wallet, _newQuota, block.timestamp.add(QUOTA_PENDING_PERIOD));
        }
    }

    function changeDailyQuotaWA(
        SignedRequest.Request calldata request,
        uint newQuota
        )
        external
    {
        controller().verifyRequest(
            TRANSFER_DOMAIN_SEPERATOR,
            txAwareHash(),
            GuardianUtils.SigRequirement.OwnerRequired,
            request,
            abi.encode(
                CHANGE_DAILY_QUOTE_TYPEHASH,
                request.wallet,
                request.validUntil,
                newQuota
            )
        );

        controllerCache.quotaStore.changeQuota(request.wallet, newQuota, block.timestamp);
    }

    function transferToken(
        address        wallet,
        address        token,
        address        to,
        uint           amount,
        bytes calldata logdata
        )
        external
        txAwareHashNotAllowed()
        onlyFromWalletOrOwnerWhenUnlocked(wallet)
    {
        if (amount > 0 && !isTargetWhitelisted(wallet, to)) {
            updateQuota(wallet, token, amount);
        }

        transferInternal(wallet, token, to, amount, logdata);
    }

    function transferTokenWA(
        SignedRequest.Request calldata request,
        address        token,
        address        to,
        uint           amount,
        bytes calldata logdata
        )
        external
    {
        controller().verifyRequest(
            TRANSFER_DOMAIN_SEPERATOR,
            txAwareHash(),
            GuardianUtils.SigRequirement.OwnerRequired,
            request,
            abi.encode(
                TRANSFER_TOKEN_TYPEHASH,
                request.wallet,
                request.validUntil,
                token,
                to,
                amount,
                keccak256(logdata)
            )
        );

        transferInternal(request.wallet, token, to, amount, logdata);
    }

    function callContract(
        address            wallet,
        address            to,
        uint               value,
        bytes     calldata data
        )
        external
        txAwareHashNotAllowed()
        onlyFromWalletOrOwnerWhenUnlocked(wallet)
        returns (bytes memory returnData)
    {
        if (value > 0 && !isTargetWhitelisted(wallet, to)) {
            updateQuota(wallet, address(0), value);
        }

        return callContractInternal(wallet, to, value, data);
    }

    function callContractWA(
        SignedRequest.Request calldata request,
        address        to,
        uint           value,
        bytes calldata data
        )
        external
        returns (bytes memory returnData)
    {
        controller().verifyRequest(
            TRANSFER_DOMAIN_SEPERATOR,
            txAwareHash(),
            GuardianUtils.SigRequirement.OwnerRequired,
            request,
            abi.encode(
                CALL_CONTRACT_TYPEHASH,
                request.wallet,
                request.validUntil,
                to,
                value,
                keccak256(data)
            )
        );

        return callContractInternal(request.wallet, to, value, data);
    }

    function approveToken(
        address wallet,
        address token,
        address to,
        uint    amount
        )
        external
        txAwareHashNotAllowed()
        onlyFromWalletOrOwnerWhenUnlocked(wallet)
    {
        uint additionalAllowance = approveInternal(wallet, token, to, amount);

        if (additionalAllowance > 0 && !isTargetWhitelisted(wallet, to)) {
            updateQuota(wallet, token, additionalAllowance);
        }
    }

    function approveTokenWA(
        SignedRequest.Request calldata request,
        address token,
        address to,
        uint    amount
        )
        external
    {
        controller().verifyRequest(
            TRANSFER_DOMAIN_SEPERATOR,
            txAwareHash(),
            GuardianUtils.SigRequirement.OwnerRequired,
            request,
            abi.encode(
                APPROVE_TOKEN_TYPEHASH,
                request.wallet,
                request.validUntil,
                token,
                to,
                amount
            )
        );

        approveInternal(request.wallet, token, to, amount);
    }

    function approveThenCallContract(
        address        wallet,
        address        token,
        address        to,
        uint           amount,
        uint           value,
        bytes calldata data
        )
        external
        txAwareHashNotAllowed()
        onlyFromWalletOrOwnerWhenUnlocked(wallet)
        returns (bytes memory returnData)
    {
        uint additionalAllowance = approveInternal(wallet, token, to, amount);

        if ((additionalAllowance > 0 || value > 0) && !isTargetWhitelisted(wallet, to)) {
            updateQuota(wallet, token, additionalAllowance);
            updateQuota(wallet, address(0), value);
        }

        return callContractInternal(wallet, to, value, data);
    }

    function approveThenCallContractWA(
        SignedRequest.Request calldata request,
        address        token,
        address        to,
        uint           amount,
        uint           value,
        bytes calldata data
        )
        external
        returns (bytes memory returnData)
    {
        bytes memory encoded = abi.encode(
            APPROVE_THEN_CALL_CONTRACT_TYPEHASH,
            request.wallet,
            request.validUntil,
            token,
            to,
            amount,
            value,
            keccak256(data)
        );

        controller().verifyRequest(
            TRANSFER_DOMAIN_SEPERATOR,
            txAwareHash(),
            GuardianUtils.SigRequirement.OwnerRequired,
            request,
            encoded
        );

        approveInternal(request.wallet, token, to, amount);
        return callContractInternal(request.wallet, to, value, data);
    }

    function getDailyQuota(address wallet)
        public
        view
        returns (
            uint total,
            uint spent,
            uint available
        )
    {
        total = controllerCache.quotaStore.currentQuota(wallet);
        spent = controllerCache.quotaStore.spentQuota(wallet);
        available = controllerCache.quotaStore.availableQuota(wallet);
    }
}
