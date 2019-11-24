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

import "../../lib/AddressUtil.sol";
import "../../lib/MathUint.sol";
import "../../lib/SignatureUtil.sol";

import "../../thirdparty/ERC1271.sol";

import "../../iface/Wallet.sol";

import "./SecurityModule.sol";


/// @title DailyQuotaMadule
contract DailyQuotaMadule is SecurityModule
{
    using MathUint for uint;

    uint constant internal INFINITE = uint(-1);
    uint internal defaultQuota;

    struct Quota
    {
        uint    currentQuota; // 0 indicates default
        uint    pendingQuota;
        uint64  pengingUntil;
        uint64  spentDay;
        uint    spentAmount;
    }

    mapping (address => Quota) internal quotas;

    event QuotaChangeScheduled(
        address indexed wallet,
        uint            pendingQuota,
        uint64          pendingUntil
    );

    constructor(
        SecurityStorage _securityStorage,
        uint _defaultQuota)
        public
        SecurityModule(_securityStorage)
    {
        defaultQuota = _defaultQuota;
    }

    function changeQuota(
        address wallet,
        uint    newQuota
        )
        internal
    {
        quotas[wallet].currentQuota = currentQuota(wallet);
        quotas[wallet].pendingQuota = newQuota;
        quotas[wallet].pengingUntil = nextEffectiveDay();

        emit QuotaChangeScheduled(
            wallet,
            newQuota,
            quotas[wallet].pengingUntil
        );
    }

    function checkAndAddToSpent(
        address wallet,
        uint    amount
        )
        internal
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
        internal
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
            q.pengingUntil > 0 &&
            q.pengingUntil <= todayInChina()) ?
            q.pendingQuota : q.currentQuota;

        return value == 0 ? defaultQuota : value;
    }

    function pendingQuota(address wallet)
        public
        view
        returns (
            uint _pendingQuota,
            uint _pengingUntil
        )
    {
        Quota storage q = quotas[wallet];
        if (q.pengingUntil > todayInChina()) {
            _pendingQuota = q.pendingQuota > 0 ? q.pendingQuota : defaultQuota;
            _pengingUntil = q.pengingUntil;
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

    /// @dev Return the days since epoch for Beijing (UTC+8)
    function todayInChina()
        internal
        view
        returns (uint64)
    {
        return uint64(((now / 3600) + 8) / 24);
    }

    function nextEffectiveDay()
        internal
        view
        returns (uint64)
    {
        uint hrs = (now / 3600) + 8;
        uint64 tomorrow = uint64(hrs / 24 + 1); // tomorrow
        return (hrs % 24 < 12) ? tomorrow + 1 : tomorrow;
    }
}
