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
pragma experimental ABIEncoderV2;


/// @title IExchangeV3Maintenance
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
contract IExchangeV3Maintenance
{
    /// @dev Starts or continues maintenance mode for the specified duration.
    ///      The necessary additional downtime minutes will be purchased. The number of
    ///      downtime minutes still available for use can be checked with getRemainingDowntime().
    ///      In maintenance mode, all onchain user requests, including account creation,
    ///      account update, deposits, and withdrawal requests are disabled.
    ///
    ///      The remaining downtime time will be extended so that the exchange can stay in
    ///      maintenance mode for at least `durationMinutes`.
    ///
    ///      The exchange owner can exit maintenance mode by calling stopMaintenanceMode()
    ///      or by waiting until the remaining downtime is reduced to 0.
    ///
    ///      Once entering the maintenance mode, the operator should still fulfill his duty
    ///      by submitting blocks and proofs until all pending user requests have been taken
    ///      care of within the required timeouts. In the maintenance mode, operator can no longer
    ///      submit settlement blocks.
    ///
    ///      After all pending onchain requests have been handled, the operator can no longer
    ///      submit blocks of any type until maintenance mode is no longer active.
    ///
    ///      This function is only callable by the exchange owner.
    ///
    /// @param durationMinutes The duration in minutes that this exchange can remain in
    ///                        the maintenance mode.
    function startOrContinueMaintenanceMode(
        uint durationMinutes
        )
        external;

    /// @dev Gets the exchange out of maintenance mode.
    ///
    ///      This function is only callable by the exchange owner.
    function stopMaintenanceMode()
        external;

    /// @dev Gets the remaining downtime.
    /// @return durationSeconds Remaining downtime in second.
    function getRemainingDowntime()
        external
        view
        returns (uint durationMinutes);

    /// @dev Gets the amount of LRC to burn for buying the downtime.
    /// @return costLRC The amount of LRC to burn
    function getDowntimeCostLRC(
        uint durationMinutes
        )
        external
        view
        returns (uint costLRC);

    /// @dev Gets the total amount of time in seconds the exchange has ever been in maintenance.
    /// @return timeInSeconds The total time in maintenance.
    function getTotalTimeInMaintenanceSeconds()
        external
        view
        returns (uint timeInSeconds);
}
