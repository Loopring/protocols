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
pragma solidity 0.5.10;

import "../../lib/Claimable.sol";
import "../../lib/MathUint.sol";

import "../../iface/IDowntimeCostCalculator.sol";


/// @title The default IDowntimeCostCalculator implementation.
/// @author Daniel Wang  - <daniel@loopring.org>
contract DowntimeCostCalculator is IDowntimeCostCalculator, Claimable
{
    using MathUint for uint;

    uint public basePrice;
    uint public maxPenalty;
    uint public gracePeriods;
    uint public gracePeriodPrice;
    uint public maxAwailableDowntime;

    event SettingsUpdated(
        uint oldBasePrice,
        uint oldMaxPenalty,
        uint oldGracePeriodMinutes,
        uint oldGracePeriodPrice,
        uint oldMaxAwailableDowntime
    );

    constructor(
        uint _basePrice,
        uint _maxPenalty,
        uint _gracePeriods,
        uint _gracePeriodPrice,
        uint _maxAwailableDowntime
        )
        Claimable()
        public
    {
        updateSettings(
            _basePrice,
            _maxPenalty,
            _gracePeriods,
            _gracePeriodPrice,
            _maxAwailableDowntime
        );
    }

    function getDowntimeCostLRC(
        uint  totalTimeInMaintanance,
        uint  totalLifetime,
        uint  awailableDowntime,
        uint  /* exchangeStakedLRC */,
        uint  downtimeToPurchase
        )
        external
        view
        returns (uint)
    {
        uint newCost = getTotalCost(
            totalTimeInMaintanance,
            totalLifetime,
            awailableDowntime.add(downtimeToPurchase)
        );

        uint oldCost = getTotalCost(
            totalTimeInMaintanance,
            totalLifetime,
            awailableDowntime
        );

        return newCost > oldCost ? newCost - oldCost : 0;
    }

    function updateSettings(
        uint _basePrice,
        uint _maxPenalty,
        uint _gracePeriods,
        uint _gracePeriodPrice,
        uint _maxAwailableDowntime
        )
        public
        onlyOwner
    {
        require(
            _basePrice > 0 && _maxPenalty > 0 &&
            _gracePeriodPrice > 0 && _maxAwailableDowntime > 0,
            "ZERO_VALUE"
        );
        require(_gracePeriodPrice <= _basePrice, "INVALID_PRICE");

        emit SettingsUpdated(
            basePrice,
            maxPenalty,
            gracePeriods,
            gracePeriodPrice,
            maxAwailableDowntime
        );

        basePrice = _basePrice;
        maxPenalty = _maxPenalty;
        gracePeriods = _gracePeriods;
        gracePeriodPrice = _gracePeriodPrice;
        maxAwailableDowntime = _maxAwailableDowntime;
    }

    function getTotalCost(
        uint totalTimeInMaintanance,
        uint totalLifetime,
        uint downtime
        )
        private
        view
        returns (uint)
    {
        require(downtime <= maxAwailableDowntime, "PURCHASE_PROHIBITED");
        uint total = totalTimeInMaintanance.add(downtime);

        if (total <= gracePeriods) {
            return total.mul(gracePeriodPrice);
        }

        uint timeBeyondGracePeriod = total - gracePeriods;
        uint penalty = timeBeyondGracePeriod.mul(10000) / totalLifetime + 100;
        uint _maxPenalty = maxPenalty.mul(100);

        if (penalty > _maxPenalty) {
            penalty = _maxPenalty;
        }

        return gracePeriods.mul(gracePeriodPrice).add(
            timeBeyondGracePeriod.mul(basePrice).mul(penalty) / 100
        );
    }
}
