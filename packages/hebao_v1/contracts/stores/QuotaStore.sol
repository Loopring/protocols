// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../base/DataStore.sol";
import "../lib/MathUint.sol";
import "../lib/Claimable.sol";
import "../thirdparty/SafeCast.sol";

/// @title QuotaStore
/// @dev This store maintains daily spending quota for each wallet.
///      A rolling daily limit is used.
contract QuotaStore is DataStore, Claimable
{
    using MathUint for uint;
    using SafeCast for uint;

    uint128 public defaultQuota;

    // Optimized to fit into 64 bytes (2 slots)
    struct Quota
    {
        uint128 currentQuota; // 0 indicates default
        uint128 pendingQuota;
        uint128 spentAmount;
        uint64  spentTimestamp;
        uint64  pendingUntil;
    }

    mapping (address => Quota) public quotas;

    event DefaultQuotaChanged(
        uint prevValue,
        uint currentValue
    );

    event QuotaScheduled(
        address wallet,
        uint    pendingQuota,
        uint64  pendingUntil
    );

    constructor(uint128 _defaultQuota)
        DataStore()
    {
        defaultQuota = _defaultQuota;
    }

    function changeDefaultQuota(uint128 _defaultQuota)
        external
        onlyOwner
    {
        require(
            _defaultQuota != defaultQuota &&
            _defaultQuota >= 1 ether &&
            _defaultQuota <= 100 ether,
            "INVALID_DEFAULT_QUOTA"
        );
        emit DefaultQuotaChanged(defaultQuota, _defaultQuota);
        defaultQuota = _defaultQuota;
    }

    function changeQuota(
        address wallet,
        uint    newQuota,
        uint    effectiveTime
        )
        public
        onlyWalletModule(wallet)
    {
        quotas[wallet].currentQuota = currentQuota(wallet).toUint128();
        quotas[wallet].pendingQuota = newQuota.toUint128();
        quotas[wallet].pendingUntil = effectiveTime.toUint64();

        emit QuotaScheduled(
            wallet,
            newQuota,
            quotas[wallet].pendingUntil
        );
    }

    function checkAndAddToSpent(
        address wallet,
        uint    amount
        )
        public
        onlyWalletModule(wallet)
    {
        require(hasEnoughQuota(wallet, amount), "QUOTA_EXCEEDED");
        addToSpent(wallet, amount);
    }

    function addToSpent(
        address wallet,
        uint    amount
        )
        public
        onlyWalletModule(wallet)
    {
        Quota storage q = quotas[wallet];
        q.spentAmount = spentQuota(wallet).add(amount).toUint128();
        q.spentTimestamp = uint64(block.timestamp);
    }

    function currentQuota(address wallet)
        public
        view
        returns (uint)
    {
        Quota storage q = quotas[wallet];
        uint value = q.pendingUntil <= block.timestamp ?
            q.pendingQuota : q.currentQuota;

        return value == 0 ? defaultQuota : value;
    }

    function pendingQuota(address wallet)
        public
        view
        returns (
            uint _pendingQuota,
            uint _pendingUntil
        )
    {
        Quota storage q = quotas[wallet];
        if (q.pendingUntil > 0 && q.pendingUntil > block.timestamp) {
            _pendingQuota = q.pendingQuota > 0 ? q.pendingQuota : defaultQuota;
            _pendingUntil = q.pendingUntil;
        }
    }

    function spentQuota(address wallet)
        public
        view
        returns (uint)
    {
        Quota storage q = quotas[wallet];
        uint timeSinceLastSpent = block.timestamp.sub(q.spentTimestamp);
        if (timeSinceLastSpent < 1 days) {
            return uint(q.spentAmount).sub(timeSinceLastSpent.mul(q.spentAmount) / 1 days);
        } else {
            return 0;
        }
    }

    function availableQuota(address wallet)
        public
        view
        returns (uint)
    {
        uint quota = currentQuota(wallet);
        uint spent = spentQuota(wallet);
        return quota > spent ? quota - spent : 0;
    }

    function hasEnoughQuota(
        address wallet,
        uint    requiredAmount
        )
        public
        view
        returns (bool)
    {
        return availableQuota(wallet) >= requiredAmount;
    }
}
