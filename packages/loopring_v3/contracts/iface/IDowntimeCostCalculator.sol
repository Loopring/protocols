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
pragma solidity ^0.6.6;
pragma experimental ABIEncoderV2;


/// @title IDowntimeCostCalculator
/// @author Daniel Wang - <daniel@loopring.org>
interface IDowntimeCostCalculator
{
    /// @dev Returns the amount LRC required to purchase the given downtime.
    /// @param totalTimeInMaintenanceSeconds The total time a DEX has been in maintain mode.
    /// @param totalDEXLifeTimeSeconds The DEX's total life time since genesis.
    /// @param numDowntimeMinutes The current downtime balance in minutes before purchase.
    /// @param exchangeStakedLRC The number of LRC staked by the DEX's owner.
    /// @param durationToPurchaseMinutes The downtime in minute to purchase.
    /// @return cost The cost in LRC for purchasing the downtime.
    function getDowntimeCostLRC(
        uint  totalTimeInMaintenanceSeconds,
        uint  totalDEXLifeTimeSeconds,
        uint  numDowntimeMinutes,
        uint  exchangeStakedLRC,
        uint  durationToPurchaseMinutes
        )
        external
        view
        returns (uint cost);
}
