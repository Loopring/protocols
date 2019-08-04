/*

  Copyright 2017 Loopring Project Ltd (Loopring Foundation).

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for tßhe specific language governing permissions and
  limitations under the License.
*/
pragma solidity 0.5.10;


/// @title IDowntimePriceCalculator
/// @author Daniel Wang - <daniel@loopring.org>
contract IDowntimeCostCalculator
{
    /// @dev Returns the downtime price.
    /// @return price The price in LRC per minute. Returning 0 to indicate
    //                purchase failure.
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
