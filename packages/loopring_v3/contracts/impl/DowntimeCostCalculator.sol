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


/// @title A fixed price IDowntimeCostCalculator implememntation.
/// @author Daniel Wang  - <daniel@loopring.org>
contract DowntimeCostCalculator is Claimable, IDowntimeCostCalculator
{
    event PriceUpdated(uint pricePerMinute);

    using MathUint for uint;
    uint public pricePerMinute = 0;

    constructor() public Claimable() { }

    function setPrice(uint _pricePerMinute)
        external
        onlyOwner
    {
        pricePerMinute = _pricePerMinute;
        emit PriceUpdated(_pricePerMinute);
    }

    function getDowntimeCostLRC(
        uint  /* totalTimeInMaintenanceSeconds */,
        uint  /* totalDEXLifeTimeSeconds */,
        uint  /* numDowntimeMinutes */,
        uint  /* exchangeStakedLRC */,
        uint  durationToPurchaseMinutes
        )
        external
        view
        returns (uint)
    {
        return durationToPurchaseMinutes.mul(pricePerMinute);
    }
}
