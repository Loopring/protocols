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

import "../lib/Claimable.sol";
import "../lib/MathUint.sol";

import "../iface/IDowntimeCostCalculator.sol";


/// @title The default IDowntimeCostCalculator implementation.
/// @author Daniel Wang  - <daniel@loopring.org>
contract DowntimeCostCalculator is Claimable, IDowntimeCostCalculator
{
    using MathUint for uint;

    uint public basePricePerMinute;
    uint public maxPenalty;
    uint public gracePeriodsMinutes;
    uint public gracePeriodPricePerMinute;
    uint public maxAwailableDowntimeMinutes;

    event SettingsUpdated(
        uint oldBasePricePerMinute,
        uint oldMaxPenalty,
        uint oldGracePeriodMinutes,
        uint oldGracePeriodPricePerMinute,
        uint oldMaxAwailableDowntimeMinutes
    );

    constructor() Claimable() public {}

    function getDowntimeCostLRC(
        uint  totalTimeInMaintenanceSeconds,
        uint  totalDEXLifeTimeSeconds,
        uint  numDowntimeMinutes,
        uint  /* exchangeStakedLRC */,
        uint  durationToPurchaseMinutes
        )
        external
        view
        returns (uint)
    {
        uint newCost = getTotalCost(
            totalTimeInMaintenanceSeconds,
            totalDEXLifeTimeSeconds,
            numDowntimeMinutes.add(durationToPurchaseMinutes)
        );

        uint oldCost = getTotalCost(
            totalTimeInMaintenanceSeconds,
            totalDEXLifeTimeSeconds,
            numDowntimeMinutes
        );

        return newCost > oldCost ? newCost - oldCost : 0;
    }

    function updateSettings(
        uint _basePricePerMinute,
        uint _maxPenalty,
        uint _gracePeriodsMinutes,
        uint _gracePeriodPricePerMinute,
        uint _maxAvailableDowntimeMinutes
        )
        external
        onlyOwner
    {
        require(
            _basePricePerMinute > 0 &&
            _maxPenalty > 0 &&
            _gracePeriodPricePerMinute > 0 &&
            _maxAvailableDowntimeMinutes > 0,
            "ZERO_VALUE"
        );
        require(_gracePeriodPricePerMinute <= _basePricePerMinute, "INVALID_PRICE");

        emit SettingsUpdated(
            basePricePerMinute,
            maxPenalty,
            gracePeriodsMinutes,
            gracePeriodPricePerMinute,
            maxAwailableDowntimeMinutes
        );

        basePricePerMinute = _basePricePerMinute;
        maxPenalty = _maxPenalty;
        gracePeriodsMinutes = _gracePeriodsMinutes;
        gracePeriodPricePerMinute = _gracePeriodPricePerMinute;
        maxAwailableDowntimeMinutes = _maxAvailableDowntimeMinutes;
    }

    function getTotalCost(
        uint totalTimeInMaintenanceSeconds,
        uint totalDEXLifeTimeSeconds,
        uint downtimeMinutes
        )
        private
        view
        returns (uint)
    {
        require(downtimeMinutes <= maxAwailableDowntimeMinutes, "PURCHASE_PROHIBITED");
        uint totalMinutes = downtimeMinutes.add(totalTimeInMaintenanceSeconds / 60);

        if (totalMinutes <= gracePeriodsMinutes) {
            return totalMinutes.mul(gracePeriodPricePerMinute);
        }

        uint timeBeyondGracePeriodMinutes = totalMinutes - gracePeriodsMinutes;
        uint penalty = timeBeyondGracePeriodMinutes.mul(600000) / totalDEXLifeTimeSeconds + 100;
        uint _maxPenalty = maxPenalty.mul(100);

        if (penalty > _maxPenalty) {
            penalty = _maxPenalty;
        }

        return gracePeriodsMinutes.mul(gracePeriodPricePerMinute).add(
            timeBeyondGracePeriodMinutes.mul(basePricePerMinute).mul(penalty) / 100
        );
    }
}
