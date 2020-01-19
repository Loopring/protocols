/*

  Copyright 2017 Loopring Project Ltd (Loopring Foundation).

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/
pragma solidity ^0.6.0;

import "../lib/MathUint.sol";

import "../base/DataStore.sol";
import "../iface/QuotaManager.sol";


/// @title QuotaStore
/// @dev This store maintains daily spending quota for each wallet.
///      A rolling daily limit is used.
contract QuotaStore is DataStore, QuotaManager
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

    event QuotaScheduled(
        address indexed wallet,
        uint            pendingQuota,
        uint64          pendingUntil
    );

    constructor(uint _defaultQuota)
        public
        DataStore()
    {
        defaultQuota = _defaultQuota;
    }

    function changeQuota(
        address wallet,
        uint    newQuota,
        uint    effectiveTime
        )
        public
        onlyManager
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
        override
        onlyManager
    {
        require(hasEnoughQuota(wallet, amount), "QUOTA_EXCEEDED");
        addToSpent(wallet, amount);
    }

    function addToSpent(
        address wallet,
        uint    amount
        )
        public
        onlyManager
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
        override
        returns (bool)
    {
        return availableQuota(wallet) >= requiredAmount;
    }
}
