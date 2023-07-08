// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;
pragma experimental ABIEncoderV2;

import "./WalletData.sol";
import "../../iface/PriceOracle.sol";
import "../../lib/MathUint.sol";
import "../../thirdparty/SafeCast.sol";
import "./ApprovalLib.sol";
import "../../lib/EIP712.sol";

/// @title QuotaLib
/// @dev This store maintains daily spending quota for each wallet.
///      A rolling daily limit is used.
library QuotaLib {
    using MathUint for uint;
    using SafeCast for uint;

    uint128 public constant MAX_QUOTA = type(uint128).max;
    uint public constant QUOTA_PENDING_PERIOD = 1 days;
    SigRequirement public constant sigRequirement =
        SigRequirement.MAJORITY_OWNER_REQUIRED;

    bytes32 public constant CHANGE_DAILY_QUOTE_TYPEHASH =
        keccak256(
            "changeDailyQuota(address wallet,uint256 validUntil,uint256 newQuota,bytes32 userOpHash)"
        );

    event QuotaScheduled(
        address wallet,
        uint pendingQuota,
        uint64 pendingUntil
    );

    function changeDailyQuota(Wallet storage wallet, uint newQuota) public {
        setQuota(wallet, newQuota, block.timestamp.add(QUOTA_PENDING_PERIOD));
    }

    function changeDailyQuotaWA(Wallet storage wallet, uint newQuota) public {
        setQuota(wallet, newQuota, 0);
    }

    function checkAndAddToSpent(
        Wallet storage wallet,
        PriceOracle priceOracle,
        address token,
        uint amount
    ) internal {
        Quota memory q = wallet.quota;
        uint available = _availableQuota(q);
        if (available != MAX_QUOTA) {
            uint value = (token == address(0))
                ? amount
                : (
                    (address(priceOracle) == address(0))
                        ? 0
                        : priceOracle.tokenValue(token, amount)
                );

            if (value > 0) {
                require(available >= value, "QUOTA_EXCEEDED");
                _addToSpent(wallet, q, value);
            }
        }
    }

    // 0 for newQuota indicates unlimited quota, or daily quota is disabled.
    function setQuota(
        Wallet storage wallet,
        uint newQuota,
        uint effectiveTime
    ) internal {
        require(newQuota <= MAX_QUOTA, "INVALID_VALUE");
        if (newQuota == MAX_QUOTA) {
            newQuota = 0;
        }

        uint __currentQuota = currentQuota(wallet);
        // Always allow the quota to be changed immediately when the quota doesn't increase
        if (
            (__currentQuota >= newQuota && newQuota != 0) || __currentQuota == 0
        ) {
            effectiveTime = 0;
        }

        Quota storage quota = wallet.quota;
        quota.currentQuota = __currentQuota.toUint128();
        quota.pendingQuota = newQuota.toUint128();
        quota.pendingUntil = effectiveTime.toUint64();

        emit QuotaScheduled(address(this), newQuota, quota.pendingUntil);
    }

    // Returns 0 to indiciate unlimited quota
    function currentQuota(Wallet storage wallet) internal view returns (uint) {
        return _currentQuota(wallet.quota);
    }

    // Returns 0 to indiciate unlimited quota
    function pendingQuota(
        Wallet storage wallet
    ) internal view returns (uint __pendingQuota, uint __pendingUntil) {
        return _pendingQuota(wallet.quota);
    }

    function spentQuota(Wallet storage wallet) internal view returns (uint) {
        return _spentQuota(wallet.quota);
    }

    function availableQuota(
        Wallet storage wallet
    ) internal view returns (uint) {
        return _availableQuota(wallet.quota);
    }

    function hasEnoughQuota(
        Wallet storage wallet,
        uint requiredAmount
    ) internal view returns (bool) {
        return _hasEnoughQuota(wallet.quota, requiredAmount);
    }

    // --- Internal functions ---

    function _currentQuota(Quota memory q) private view returns (uint) {
        return
            q.pendingUntil <= block.timestamp ? q.pendingQuota : q.currentQuota;
    }

    function _pendingQuota(
        Quota memory q
    ) private view returns (uint __pendingQuota, uint __pendingUntil) {
        if (q.pendingUntil > 0 && q.pendingUntil > block.timestamp) {
            __pendingQuota = q.pendingQuota;
            __pendingUntil = q.pendingUntil;
        }
    }

    function _spentQuota(Quota memory q) private view returns (uint) {
        uint timeSinceLastSpent = block.timestamp.sub(q.spentTimestamp);
        if (timeSinceLastSpent < 1 days) {
            return
                uint(q.spentAmount).sub(
                    timeSinceLastSpent.mul(q.spentAmount) / 1 days
                );
        } else {
            return 0;
        }
    }

    function _availableQuota(Quota memory q) private view returns (uint) {
        uint quota = _currentQuota(q);
        if (quota == 0) {
            return MAX_QUOTA;
        }
        uint spent = _spentQuota(q);
        return quota > spent ? quota - spent : 0;
    }

    function _hasEnoughQuota(
        Quota memory q,
        uint requiredAmount
    ) private view returns (bool) {
        return _availableQuota(q) >= requiredAmount;
    }

    function _addToSpent(
        Wallet storage wallet,
        Quota memory q,
        uint amount
    ) private {
        Quota storage s = wallet.quota;
        s.spentAmount = _spentQuota(q).add(amount).toUint128();
        s.spentTimestamp = uint64(block.timestamp);
    }

    function encodeApprovalForChangeDailyQuota(
        bytes memory data,
        bytes32 domainSeparator,
        uint256 validUntil,
        bytes32 userOpHash
    ) internal view returns (bytes32) {
        uint256 newQuota = abi.decode(data, (uint));
        bytes32 approvedHash = EIP712.hashPacked(
            domainSeparator,
            keccak256(
                abi.encode(
                    CHANGE_DAILY_QUOTE_TYPEHASH,
                    address(this),
                    validUntil,
                    newQuota,
                    userOpHash
                )
            )
        );
        return approvedHash;
    }
}
