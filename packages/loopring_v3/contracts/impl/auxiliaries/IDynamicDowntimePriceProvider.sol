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
/// TODO(daniel): re-implement this based on feedback from Brecht.
contract IDynamicDowntimePriceProvider is IDowntimePriceProvider, Claimable
{
    using MathUint for uint;

    uint public basePrice;
    uint public maxPenalty;

    event SettingsUpdated(uint basePrice, uint maxPenalty);

    constructor(
        uint _basePrice,
        uint _maxPenalty
        )
        public
    {
        require(_maxPenalty > 0, "ZERO_VALUE");
        owner = msg.sender;
        basePrice = _basePrice;
        maxPenalty = _maxPenalty;
    }

    function getDowntimePrice(
        uint  totalTimeInMaintenanceSeconds,
        uint  totalDEXLifeTimeSeconds,
        uint  /* availableDowntimeMinutes */,
        uint  /* amountOfLRCStakedbyOwner */,
        uint  /* durationToPurchaseMinutes */
        )
        external
        view
        returns (uint)
    {
        // Initially, the penalty is the percentage of DEX's downtime.
        uint penalty = totalTimeInMaintenanceSeconds.mul(100) / totalDEXLifeTimeSeconds + 1;

        if (penalty > maxPenalty) {
            penalty = maxPenalty;
        }

        return basePrice.mul(penalty);
    }

    function updateSettings(
        uint _basePrice,
        uint _maxPenalty
        )
        external
        onlyOwner
    {
        require(_basePrice != basePrice || _maxPenalty != maxPenalty, "SAME_VALUE");

        basePrice = _basePrice;
        maxPenalty = _maxPenalty;

        emit SettingsUpdated(basePrice, maxPenalty);
    }

}
