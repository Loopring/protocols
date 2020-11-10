// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../base/DataStore.sol";
import "../iface/IPriceOracle.sol";
import "../iface/IStoreAccessManager.sol";
import "../lib/MathUint.sol";
import "../thirdparty/SafeCast.sol";

/// @title QuotaStore
/// @dev This store maintains daily spending quota for each wallet.
///      A rolling daily limit is used.
contract QuotaStore is DataStore
{
    using MathUint for uint;
    using SafeCast for uint;

    uint128 public constant MAX_QUOTA = uint128(-1);

    // Optimized to fit into 64 bytes (2 slots)
    struct Quota
    {
        uint128 currentQuota;
        uint128 pendingQuota;
        uint128 spentAmount;
        uint64  spentTimestamp;
        uint64  pendingUntil;
    }

    mapping (address => Quota) public quotas;

    event QuotaScheduled(
        address wallet,
        uint    pendingQuota,
        uint64  pendingUntil
    );

    constructor(IStoreAccessManager accessManager) DataStore(accessManager) {}

    // 0 for newQuota indicates unlimited quota, or daily quota is disabled.
    function changeQuota(
        address wallet,
        uint    newQuota,
        uint    effectiveTime
        )
        external
        onlyFromStoreAccessor
    {
        require(newQuota <= MAX_QUOTA, "INVALID_VALUE");
        if (newQuota == MAX_QUOTA) {
            newQuota = 0;
        }

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
        address     wallet,
        address     token,
        uint        amount,
        IPriceOracle priceOracle
        )
        external
    {
        Quota memory q = quotas[wallet];
        uint available = _availableQuota(q);
        if (available != MAX_QUOTA) {
            uint value = (token == address(0)) ?
                amount :
                priceOracle.tokenValue(token, amount);
            if (value > 0) {
                require(available >= value, "QUOTA_EXCEEDED");
                requireStoreAccessor();
                _addToSpent(wallet, q, value);
            }
        }
    }

    function addToSpent(
        address wallet,
        uint    amount
        )
        external
        onlyFromStoreAccessor
    {
        _addToSpent(wallet, quotas[wallet], amount);
    }

    // Returns 0 to indiciate unlimited quota
    function currentQuota(address wallet)
        public
        view
        returns (uint)
    {
        return _currentQuota(quotas[wallet]);
    }

    // Returns 0 to indiciate unlimited quota
    function pendingQuota(address wallet)
        public
        view
        returns (
            uint __pendingQuota,
            uint __pendingUntil
        )
    {
        return _pendingQuota(quotas[wallet]);
    }

    function spentQuota(address wallet)
        public
        view
        returns (uint)
    {
        return _spentQuota(quotas[wallet]);
    }

    function availableQuota(address wallet)
        public
        view
        returns (uint)
    {
        return _availableQuota(quotas[wallet]);
    }

    function hasEnoughQuota(
        address wallet,
        uint    requiredAmount
        )
        public
        view
        returns (bool)
    {
        return _hasEnoughQuota(quotas[wallet], requiredAmount);
    }

    // Internal

    function _currentQuota(Quota memory q)
        private
        view
        returns (uint)
    {
        return q.pendingUntil <= block.timestamp ? q.pendingQuota : q.currentQuota;
    }

    function _pendingQuota(Quota memory q)
        private
        view
        returns (
            uint __pendingQuota,
            uint __pendingUntil
        )
    {
        if (q.pendingUntil > 0 && q.pendingUntil > block.timestamp) {
            __pendingQuota = q.pendingQuota;
            __pendingUntil = q.pendingUntil;
        }
    }

    function _spentQuota(Quota memory q)
        private
        view
        returns (uint)
    {
        uint timeSinceLastSpent = block.timestamp.sub(q.spentTimestamp);
        if (timeSinceLastSpent < 1 days) {
            return uint(q.spentAmount).sub(timeSinceLastSpent.mul(q.spentAmount) / 1 days);
        } else {
            return 0;
        }
    }

    function _availableQuota(Quota memory q)
        private
        view
        returns (uint)
    {
        uint quota = _currentQuota(q);
        if (quota == 0) {
            return MAX_QUOTA;
        }
        uint spent = _spentQuota(q);
        return quota > spent ? quota - spent : 0;
    }

    function _hasEnoughQuota(
        Quota   memory q,
        uint    requiredAmount
        )
        private
        view
        returns (bool)
    {
        return _availableQuota(q) >= requiredAmount;
    }

    function _addToSpent(
        address wallet,
        Quota   memory q,
        uint    amount
        )
        private
    {
        Quota storage s = quotas[wallet];
        s.spentAmount = _spentQuota(q).add(amount).toUint128();
        s.spentTimestamp = uint64(block.timestamp);
    }
}
