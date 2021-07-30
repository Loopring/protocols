// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "./ApprovalLib.sol";
import "./WalletData.sol";
import "../../iface/PriceOracle.sol";
import "../../lib/MathUint.sol";
import "../../thirdparty/SafeCast.sol";


/// @title QuotaLib
/// @dev This store maintains daily spending quota for each wallet.
///      A rolling daily limit is used.
library QuotaLib
{
    using MathUint      for uint;
    using SafeCast      for uint;
    using ApprovalLib   for Wallet;

    uint128 public constant MAX_QUOTA = uint128(-1);
    uint    public constant QUOTA_PENDING_PERIOD = 1 days;

    bytes32 public constant CHANGE_DAILY_QUOTE_TYPEHASH = keccak256(
        "changeDailyQuota(address wallet,uint256 validUntil,uint256 newQuota)"
    );

    event QuotaScheduled(
        address wallet,
        uint    pendingQuota,
        uint64  pendingUntil
    );

    function changeDailyQuota(
        Wallet storage wallet,
        uint           newQuota
        )
        public
    {
        Quota memory q = wallet.quota;
        uint currentQuota = _currentQuota(q);
        if (currentQuota == 0) {
            currentQuota = MAX_QUOTA;
        }
        uint _newQuota = newQuota == 0 ? MAX_QUOTA : newQuota;
        uint effectiveTime = _newQuota <= currentQuota ?
            0 : block.timestamp.add(QUOTA_PENDING_PERIOD);

        setQuota(wallet, newQuota, effectiveTime);
    }

    function changeDailyQuotaWA(
        Wallet   storage   wallet,
        bytes32            domainSeparator,
        Approval calldata  approval,
        uint               newQuota
        )
        public
        returns (bytes32 approvedHash)
    {
        approvedHash = wallet.verifyApproval(
            domainSeparator,
            SigRequirement.MAJORITY_OWNER_REQUIRED,
            approval,
            abi.encode(
                CHANGE_DAILY_QUOTE_TYPEHASH,
                approval.wallet,
                approval.validUntil,
                newQuota
            )
        );
        setQuota(wallet, newQuota, 0);
    }

    function checkAndAddToSpent(
        Wallet      storage wallet,
        PriceOracle         priceOracle,
        address             token,
        uint                amount
        )
        internal
    {
        Quota memory q = wallet.quota;
        uint available = _availableQuota(q);
        if (available != MAX_QUOTA) {
            uint value = (token == address(0)) ?
                amount :
                ((address(priceOracle) == address(0)) ?
                 0 :
                 priceOracle.tokenValue(token, amount));

            if (value > 0) {
                require(available >= value, "QUOTA_EXCEEDED");
                _addToSpent(wallet, q, value);
            }
        }
    }

    // 0 for newQuota indicates unlimited quota, or daily quota is disabled.
    function setQuota(
        Wallet storage wallet,
        uint           newQuota,
        uint           effectiveTime
        )
        internal
    {
        require(newQuota <= MAX_QUOTA, "INVALID_VALUE");
        if (newQuota == MAX_QUOTA) {
            newQuota = 0;
        }

        Quota storage quota = wallet.quota;
        quota.currentQuota = _currentQuota(wallet.quota).toUint128();
        quota.pendingQuota = newQuota.toUint128();
        quota.pendingUntil = effectiveTime.toUint64();

        emit QuotaScheduled(
            address(this),
            newQuota,
            quota.pendingUntil
        );
    }

    // Returns 0 to indiciate unlimited quota
    function pendingQuota(Wallet storage wallet)
        internal
        view
        returns (
            uint __pendingQuota,
            uint __pendingUntil
        )
    {
        return _pendingQuota(wallet.quota);
    }

    function spentQuota(Wallet storage wallet)
        internal
        view
        returns (uint)
    {
        return _spentQuota(wallet.quota);
    }

    function availableQuota(Wallet storage wallet)
        internal
        view
        returns (uint)
    {
        return _availableQuota(wallet.quota);
    }

    function hasEnoughQuota(
        Wallet storage wallet,
        uint               requiredAmount
        )
        internal
        view
        returns (bool)
    {
        return _hasEnoughQuota(wallet.quota, requiredAmount);
    }

    // --- Internal functions ---

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
        Wallet storage wallet,
        Quota   memory q,
        uint    amount
        )
        private
    {
        Quota storage s = wallet.quota;
        s.spentAmount = _spentQuota(q).add(amount).toUint128();
        s.spentTimestamp = uint64(block.timestamp);
    }
}
