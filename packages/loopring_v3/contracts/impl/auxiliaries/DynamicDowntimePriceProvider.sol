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

import "../../iface/IDowntimePriceProvider.sol";


/// @title An simple implementation of IDowntimePriceProvider.
/// @author Daniel Wang  - <daniel@loopring.org>
contract DynamicDowntimePriceProvider is IDowntimePriceProvider, Claimable
{
    using MathUint for uint;

    uint public basePrice;
    uint public maxPenalty;
    uint public gracePeriodMinutes;
    uint public maxNumDowntimeMinutes;

    event SettingsUpdated(
        uint oldBasePrice,
        uint oldMaxPenalty,
        uint oldGracePeriodMinutes,
        uint oldMaxNumDowntimeMinutes
    );

    constructor(
        uint _basePrice,
        uint _maxPenalty,
        uint _gracePeriodMinutes,
        uint _maxNumDowntimeMinutes
        )
        Claimable()
        public
    {
        updateSettings(
            _basePrice,
            _maxPenalty,
            _gracePeriodMinutes,
            _maxNumDowntimeMinutes
        );
    }

    function getDowntimePrice(
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
        uint total = numDowntimeMinutes.add(durationToPurchaseMinutes);
        if (total <= gracePeriodMinutes) {
            return basePrice;
        }

        if (total > maxNumDowntimeMinutes) {
            return 0;
        }

        // Initially, the penalty is the percentage of DEX's downtime.
        uint penalty = totalTimeInMaintenanceSeconds.mul(100) / totalDEXLifeTimeSeconds + 1;

        if (penalty > maxPenalty) {
            penalty = maxPenalty;
        }

        return basePrice.mul(penalty);
    }

    function updateSettings(
        uint _basePrice,
        uint _maxPenalty,
        uint _gracePeriodMinutes,
        uint _maxNumDowntimeMinutes
        )
        public
        onlyOwner
    {
        require(_basePrice > 0 && _maxPenalty > 0 && _maxNumDowntimeMinutes > 0, "ZERO_VALUE");
        require(_gracePeriodMinutes < _maxNumDowntimeMinutes, "INVALID_GRACE_PERIOD");

        emit SettingsUpdated(basePrice, maxPenalty, gracePeriodMinutes, maxNumDowntimeMinutes);

        basePrice = _basePrice;
        maxPenalty = _maxPenalty;
        gracePeriodMinutes = _gracePeriodMinutes;
        maxNumDowntimeMinutes = _maxNumDowntimeMinutes;
    }

}
