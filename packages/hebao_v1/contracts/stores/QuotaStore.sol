// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.6.10;

import "../base/DataStore.sol";
import "../lib/MathUint.sol";
import "../lib/Claimable.sol";


/// @title QuotaStore
/// @dev This store maintains daily spending quota for each wallet.
///      A rolling daily limit is used.
contract QuotaStore is DataStore, Claimable
{
    using MathUint for uint;

    uint public defaultQuota;

    struct Quota
    {
        uint    currentQuota; // 0 indicates default
        uint    pendingQuota;
        uint64  pendingUntil;
        uint64  spentTimestamp;
        uint    spentAmount;
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

    constructor(uint _defaultQuota)
        public
        DataStore()
    {
        defaultQuota = _defaultQuota;
    }

    function changeDefaultQuota(uint _defaultQuota)
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
        quotas[wallet].currentQuota = currentQuota(wallet);
        quotas[wallet].pendingQuota = newQuota;
        quotas[wallet].pendingUntil = uint64(effectiveTime);

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
        q.spentAmount = spentQuota(wallet).add(amount);
        q.spentTimestamp = uint64(now);
    }

    function currentQuota(address wallet)
        public
        view
        returns (uint)
    {
        Quota storage q = quotas[wallet];
        uint value = q.pendingUntil <= now ?
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
        if (q.pendingUntil > 0 && q.pendingUntil > now) {
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
        uint timeSinceLastSpent = now.sub(q.spentTimestamp);
        if (timeSinceLastSpent < 1 days) {
            return q.spentAmount.sub(q.spentAmount.mul(timeSinceLastSpent) / 1 days);
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
