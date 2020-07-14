// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.6.10;
pragma experimental ABIEncoderV2;

import "./BaseTransferModule.sol";


/// @title TransferModule
contract TransferModule is BaseTransferModule
{
    bytes32 public constant CHANGE_DAILY_QUOTE_IMMEDIATELY_TYPEHASH = keccak256(
        "changeDailyQuotaImmediately(address wallet,uint256 validUntil,uint256 newQuota)"
    );

    bytes32 public constant TRANSFER_TOKEN_TYPEHASH = keccak256(
        "transferTokenWithApproval(address wallet,uint256 validUntil,address token,address to,uint256 amount,bytes logdata)"
    );

    bytes32 public constant APPROVE_TOKEN_TYPEHASH = keccak256(
        "approveTokenWithApproval(address wallet,uint256 validUntil,address token,address to,uint256 amount)"
    );

    bytes32 public constant CALL_CONTRACT_TYPEHASH = keccak256(
        "callContractWithApproval(address wallet,uint256 validUntil,address to,uint256 value,bytes data)"
    );

    bytes32 public constant APPROVE_THEN_CALL_CONTRACT_TYPEHASH = keccak256(
        "approveThenCallContractWithApproval(address wallet,uint256 validUntil,address token,address to,uint256 amount,uint256 value,bytes data)"
    );

    uint public delayPeriod;

    constructor(
        ControllerImpl _controller,
        address        _trustedForwarder,
        uint           _delayPeriod
        )
        public
        BaseTransferModule(_controller, _trustedForwarder)
    {
        require(_delayPeriod > 0, "INVALID_DELAY");

        DOMAIN_SEPERATOR = EIP712.hash(
            EIP712.Domain("TransferModule", "1.1.0", address(this))
        );
        delayPeriod = _delayPeriod;
    }

    function changeDailyQuota(
        address wallet,
        uint    newQuota
        )
        external
        nonReentrant
        onlyFromWalletOrOwnerWhenUnlocked(wallet)
    {
        QuotaStore qs = controller.quotaStore();
        uint _newQuota = newQuota == 0 ? qs.defaultQuota(): newQuota;
        uint _currentQuota = qs.currentQuota(wallet);

        if (_currentQuota >= _newQuota) {
            qs.changeQuota(wallet, _newQuota, now);
        } else {
            qs.changeQuota(wallet, _newQuota, now.add(delayPeriod));
        }
    }

    function changeDailyQuotaImmediately(
        SignedRequest.Request calldata request,
        uint newQuota
        )
        external
        nonReentrant
        onlyWhenWalletUnlocked(request.wallet)
    {
        controller.verifyRequest(
            DOMAIN_SEPERATOR,
            txAwareHash(),
            GuardianUtils.SigRequirement.OwnerRequired,
            request,
            abi.encode(
                CHANGE_DAILY_QUOTE_IMMEDIATELY_TYPEHASH,
                request.wallet,
                request.validUntil,
                newQuota
            )
        );

        controller.quotaStore().changeQuota(request.wallet, newQuota, now);
    }

    function transferToken(
        address        wallet,
        address        token,
        address        to,
        uint           amount,
        bytes calldata logdata
        )
        external
        nonReentrant
        onlyFromWalletOrOwnerWhenUnlocked(wallet)
    {
        if (amount > 0 && !isTargetWhitelisted(wallet, to)) {
            updateQuota(wallet, token, amount);
        }

        transferInternal(wallet, token, to, amount, logdata);
    }

    function callContract(
        address            wallet,
        address            to,
        uint               value,
        bytes     calldata data
        )
        external
        nonReentrant
        onlyFromWalletOrOwnerWhenUnlocked(wallet)
        returns (bytes memory returnData)
    {
        if (value > 0 && !isTargetWhitelisted(wallet, to)) {
            updateQuota(wallet, address(0), value);
        }

        return callContractInternal(wallet, to, value, data);
    }

    function approveToken(
        address wallet,
        address token,
        address to,
        uint    amount
        )
        external
        nonReentrant
        onlyFromWalletOrOwnerWhenUnlocked(wallet)
    {
        uint additionalAllowance = approveInternal(wallet, token, to, amount);

        if (additionalAllowance > 0 && !isTargetWhitelisted(wallet, to)) {
            updateQuota(wallet, token, additionalAllowance);
        }
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
        nonReentrant
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

    function getDailyQuota(address wallet)
        public
        view
        returns (
            uint total,
            uint spent,
            uint available
        )
    {
        total = controller.quotaStore().currentQuota(wallet);
        spent = controller.quotaStore().spentQuota(wallet);
        available = controller.quotaStore().availableQuota(wallet);
    }

    function transferTokenWithApproval(
        SignedRequest.Request calldata request,
        address        token,
        address        to,
        uint           amount,
        bytes calldata logdata
        )
        external
        nonReentrant
        onlyWhenWalletUnlocked(request.wallet)
    {
        controller.verifyRequest(
            DOMAIN_SEPERATOR,
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

    function approveTokenWithApproval(
        SignedRequest.Request calldata request,
        address token,
        address to,
        uint    amount
        )
        external
        nonReentrant
        onlyWhenWalletUnlocked(request.wallet)
    {
        controller.verifyRequest(
            DOMAIN_SEPERATOR,
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

    function callContractWithApproval(
        SignedRequest.Request calldata request,
        address        to,
        uint           value,
        bytes calldata data
        )
        external
        nonReentrant
        onlyWhenWalletUnlocked(request.wallet)
        returns (bytes memory returnData)
    {
        controller.verifyRequest(
            DOMAIN_SEPERATOR,
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

    function approveThenCallContractWithApproval(
        SignedRequest.Request calldata request,
        address        token,
        address        to,
        uint           amount,
        uint           value,
        bytes calldata data
        )
        external
        nonReentrant
        onlyWhenWalletUnlocked(request.wallet)
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

        controller.verifyRequest(
            DOMAIN_SEPERATOR,
            txAwareHash(),
            GuardianUtils.SigRequirement.OwnerRequired,
            request,
            encoded
        );

        approveInternal(request.wallet, token, to, amount);
        return callContractInternal(request.wallet, to, value, data);
    }
}
