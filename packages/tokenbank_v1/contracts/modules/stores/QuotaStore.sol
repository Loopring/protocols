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
pragma solidity ^0.5.11;

import "../../lib/MathUint.sol";

import "../../base/DataStore.sol";


/// @title QuotaStore
/// @dev This store maintains daily spending quota for each wallet.
///      At the end of the day (Beijing time), the daily quota will be
///      restored.
///      Changing the quota takes at least 12 hours - if the quota is
///      changed in the first 12 hours of the day, it will take effect
///      tomorrow; otherwise it will take effect the day after tomorrow.
contract QuotaStore is DataStore
{
    using MathUint for uint;

    uint constant internal INFINITE = uint(-1);
    uint public defaultQuota;

    struct Quota
    {
        uint    currentQuota; // 0 indicates default
        uint    pendingQuota;
        uint64  pengingEffectiveDay;
        uint64  spentDay;
        uint    spentAmount;
    }

    mapping (address => Quota) public quotas;

    event QuotaScheduled(
        address indexed wallet,
        uint            pendingQuota,
        uint64          pendingUntil
    );

    constructor(
        uint    _defaultQuota,
        address _manager
        )
        public
        DataStore(_manager)
    {
        defaultQuota = _defaultQuota;
    }

    function changeQuota(
        address wallet,
        uint    newQuota
        )
        external
        onlyManager
    {
        quotas[wallet].currentQuota = currentQuota(wallet);
        quotas[wallet].pendingQuota = newQuota;
        quotas[wallet].pengingEffectiveDay = nextEffectiveDay();

        emit QuotaScheduled(
            wallet,
            newQuota,
            quotas[wallet].pengingEffectiveDay
        );
    }

    function checkAndAddToSpent(
        address wallet,
        uint    amount
        )
        public
        onlyManager
        returns (bool)
    {
        if (hasEnoughQuota(wallet, amount)) {
            addToSpent(wallet, amount);
            return true;
        }
    }

    function addToSpent(
        address wallet,
        uint    amount
        )
        public
        onlyManager
    {
        Quota storage q = quotas[wallet];
        uint64 today = todayInChina();
        if (q.spentDay == today) {
            q.spentAmount.add(amount);
        } else {
            q.spentDay = today;
            q.spentAmount = amount;
        }
    }

    function currentQuota(address wallet)
        public
        view
        returns (uint)
    {
        Quota storage q = quotas[wallet];
        uint value = (
            q.pengingEffectiveDay > 0 &&
            q.pengingEffectiveDay <= todayInChina()) ?
            q.pendingQuota : q.currentQuota;

        return value == 0 ? defaultQuota : value;
    }

    function pendingQuota(address wallet)
        public
        view
        returns (
            uint _pendingQuota,
            uint _pengingEffectiveDay
        )
    {
        Quota storage q = quotas[wallet];
        if (q.pengingEffectiveDay > todayInChina()) {
            _pendingQuota = q.pendingQuota > 0 ? q.pendingQuota : defaultQuota;
            _pengingEffectiveDay = q.pengingEffectiveDay;
        }
    }

    function spentQuota(address wallet)
        public
        view
        returns (uint)
    {
        Quota storage q = quotas[wallet];
        return q.spentDay < todayInChina() ? 0 : q.spentAmount;
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

    /// @dev Returns the days since epoch for Beijing (UTC+8)
    /// @return The day since epoch in China.
    function todayInChina()
        public
        view
        returns (uint64)
    {
        return uint64(((now / 3600) + 8) / 24);
    }

    /// @dev Returns the next effective day for a quota change.
    ///      If the change request is made in the morning, it becomes effective
    ///      tomorrow; if it is made in the afternoon, it will become effective
    ///      the day after tomorrow.
    /// @return The day the quota change will becoem effective.
    function nextEffectiveDay()
        public
        view
        returns (uint64)
    {
        uint hrs = (now / 3600) + 8;
        uint64 tomorrow = uint64(hrs / 24 + 1); // tomorrow
        return (hrs % 24 < 12) ? tomorrow + 1 : tomorrow;
    }
}
