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
    uint constant internal INFINITE = uint(-1);
    uint internal defaultQuota;
    constructor(
        SecurityStorage _securityStorage,
        uint _defaultQuota)
        public
        SecurityModule(_securityStorage)
    {
        defaultQuota = _defaultQuota;
    }

    struct Quota
    {
        uint    currentQuota; // 0 indicates default
        uint    pendingQuota;
        uint64  pengingUntil;
        uint64  lastSpendDay;
        uint    lastSpending;
    }

    mapping (address => Quota) internal quotas;

    function currentQuota(address wallet)
        public
        view
        returns (uint)
    {
        Quota storage q = quotas[wallet];
        uint value = (
            q.pengingUntil > 0 &&
            q.pengingUntil <= daysSinceEpoch()) ?
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
        if (q.pengingUntil > daysSinceEpoch()) {
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
        return q.lastSpendDay < daysSinceEpoch() ? 0 : q.lastSpending;
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

    /// @dev Return the days since epoch for Beijing (UTC+8)
    function daysSinceEpoch()
        internal
        view
        returns (uint64)
    {
        return uint64(((now / 3600) + 8) / 24);
    }
}
