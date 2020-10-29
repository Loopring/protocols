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

    bytes32 public immutable TRANSFER_DOMAIN_SEPERATOR;

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
        _changeQuota(wallet, newQuota, QUOTA_PENDING_PERIOD);
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
            GuardianUtils.SigRequirement.MAJORITY_OWNER_REQUIRED,
            request,
            abi.encode(
                CHANGE_DAILY_QUOTE_TYPEHASH,
                request.wallet,
                request.validUntil,
                newQuota
            )
        );
        _changeQuota(request.wallet, newQuota, 0);
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
        QuotaStore qs = controllerCache.quotaStore;
        if (_needCheckQuota(qs, wallet, amount) && !isTargetWhitelisted(wallet, to)) {
            _updateQuota(qs, wallet, token, amount);
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
            GuardianUtils.SigRequirement.MAJORITY_OWNER_REQUIRED,
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
        QuotaStore qs = controllerCache.quotaStore;
        if (_needCheckQuota(qs, wallet, value) && !isTargetWhitelisted(wallet, to)) {
            _updateQuota(qs, wallet, address(0), value);
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
            GuardianUtils.SigRequirement.MAJORITY_OWNER_REQUIRED,
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

        QuotaStore qs = controllerCache.quotaStore;
        if (_needCheckQuota(qs, wallet, additionalAllowance) &&
            !isTargetWhitelisted(wallet, to)) {
            _updateQuota(qs, wallet, token, additionalAllowance);
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
            GuardianUtils.SigRequirement.MAJORITY_OWNER_REQUIRED,
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

        QuotaStore qs = controllerCache.quotaStore;
        if (_needCheckQuota(qs, wallet, additionalAllowance.add(value)) &&
            !isTargetWhitelisted(wallet, to)) {
            _updateQuota(qs, wallet, token, additionalAllowance);
            _updateQuota(qs, wallet, address(0), value);
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
            GuardianUtils.SigRequirement.MAJORITY_OWNER_REQUIRED,
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
            uint total, // 0 indicates quota is disabled
            uint spent,
            uint available
        )
    {
        total = controllerCache.quotaStore.currentQuota(wallet);
        spent = controllerCache.quotaStore.spentQuota(wallet);
        available = controllerCache.quotaStore.availableQuota(wallet);
    }

    function _changeQuota(
        address wallet,
        uint    newQuota,
        uint    pendingPeriod
        )
        private
    {
        QuotaStore qs = controllerCache.quotaStore;
        uint _currentQuota = qs.currentQuota(wallet);
        require(_currentQuota != newQuota, "SAME_VALUE");

        uint _pendingPeriod = pendingPeriod;
        if (newQuota > 0 && newQuota < _currentQuota) {
            _pendingPeriod = 0;
        }

        qs.changeQuota(wallet, newQuota, block.timestamp.add(_pendingPeriod));
    }
}