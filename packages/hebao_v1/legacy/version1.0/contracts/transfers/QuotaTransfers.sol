// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.6.6;
pragma experimental ABIEncoderV2;

import "../../lib/Claimable.sol";
import "../../lib/ERC20.sol";

import "../../iface/PriceOracle.sol";
import "../../iface/Wallet.sol";

import "./TransferModule.sol";

/// @title QuotaTransfers
contract QuotaTransfers is TransferModule
{
    uint public delayPeriod;

    constructor(
        ControllerImpl _controller,
        uint         _delayPeriod
        )
        public
        TransferModule(_controller)
    {
        require(_delayPeriod > 0, "INVALID_DELAY");
        delayPeriod = _delayPeriod;
    }

    function changeDailyQuota(
        address wallet,
        uint    newQuota
        )
        external
        nonReentrant
        onlyWhenWalletUnlocked(wallet)
        onlyFromMetaTxOrWalletOwner(wallet)
    {
        controller.quotaStore().changeQuota(wallet, newQuota, now.add(delayPeriod));
    }

    function changeDailyQuotaImmediately(
        address            wallet,
        uint               newQuota
        )
        external
        nonReentrant
        onlyWhenWalletUnlocked(wallet)
        onlyFromMetaTx
    {
        controller.quotaStore().changeQuota(wallet, newQuota, now);
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
        onlyWhenWalletUnlocked(wallet)
        onlyFromMetaTxOrWalletOwner(wallet)
    {
        (bool whitelisted,) = controller.whitelistStore().isWhitelisted(wallet, to);
        if (!whitelisted) {
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
        onlyWhenWalletUnlocked(wallet)
        onlyFromMetaTxOrWalletOwner(wallet)
        returns (bytes memory returnData)
    {
        (bool whitelisted,) = controller.whitelistStore().isWhitelisted(wallet, to);
        if (!whitelisted) {
            updateQuota(wallet, address(0), value);
        }

        return callContractInternal(wallet, to, value, data);
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
        onlyFromMetaTxOrWalletOwner(wallet)
    {
        uint additionalAllowance = approveInternal(wallet, token, to, amount);
        (bool whitelisted,) = controller.whitelistStore().isWhitelisted(wallet, to);

        if (!whitelisted) {
            updateQuota(wallet, token, additionalAllowance);
        }
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
        onlyFromMetaTxOrWalletOwner(wallet)
        returns (bytes memory returnData)
    {
        uint additionalAllowance = approveInternal(wallet, token, to, amount);
        (bool whitelisted,) = controller.whitelistStore().isWhitelisted(wallet, to);

        if (!whitelisted) {
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

    function callContractInternal(
        address wallet,
        address to,
        uint    value,
        bytes   memory txData
        )
        internal
        override
        returns (bytes memory returnData)
    {
        // Disallow general calls to token contracts (for tokens that have price data
        // so the quota is actually used).
        require(controller.priceOracle().tokenValue(to, 1e18) == 0, "CALL_DISALLOWED");
        return super.callContractInternal(wallet, to, value, txData);
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
        if (
            method == this.transferToken.selector ||
            method == this.approveToken.selector ||
            method == this.callContract.selector ||
            method == this.approveThenCallContract.selector ||
            method == this.changeDailyQuota.selector
            ) {
            return isOnlySigner(Wallet(wallet).owner(), signers);
        } else if (method == this.changeDailyQuotaImmediately.selector) {
            return GuardianUtils.requireMajority(
                controller.securityStore(),
                wallet,
                signers,
                GuardianUtils.SigRequirement.OwnerRequired
            );
        } else {
            revert("INVALID_METHOD");
        }

    }

}
