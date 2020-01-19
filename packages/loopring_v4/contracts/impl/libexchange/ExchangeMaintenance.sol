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

import "../../lib/BurnableERC20.sol";
import "../../lib/MathUint.sol";

import "../../iface/IDowntimeCostCalculator.sol";

import "./ExchangeData.sol";
import "./ExchangeStatus.sol";


/// @title ExchangeMaintenance.
/// @author Daniel Wang  - <daniel@loopring.org>
/// @author Brecht Devos - <brecht@loopring.org>
library ExchangeMaintenance
{
    using MathUint              for uint;
    using ExchangeStatus        for ExchangeData.State;
    using ExchangeMaintenance   for ExchangeData.State;


    function startOrContinueMaintenanceMode(
        ExchangeData.State storage S,
        uint durationMinutes
        )
        external
    {
        require(!S.isInWithdrawalMode(), "INVALID_MODE");
        require(!S.isShutdown(), "INVALID_MODE");
        require(durationMinutes > 0, "INVALID_DURATION");

        uint numMinutesLeft = S.getNumDowntimeMinutesLeft();

        // If we automatically exited maintenance mode first call stop
        if (S.downtimeStart != 0 && numMinutesLeft == 0) {
            stopMaintenanceMode(S);
        }

        // Purchased downtime from a previous maintenance period or a previous call
        // to startOrContinueMaintenanceMode can be re-used, so we need to calculate
        // how many additional minutes we need to purchase
        if (numMinutesLeft < durationMinutes) {
            uint numMinutesToPurchase = durationMinutes.sub(numMinutesLeft);
            uint costLRC = getDowntimeCostLRC(S, numMinutesToPurchase);
            if (costLRC > 0) {
                require(
                    BurnableERC20(S.lrcAddress).burnFrom(msg.sender, costLRC),
                    "BURN_FAILURE"
                );
            }
            S.numDowntimeMinutes = S.numDowntimeMinutes.add(numMinutesToPurchase);
        }

        // Start maintenance mode if the exchange isn't in maintenance mode yet
        if (S.downtimeStart == 0) {
            S.downtimeStart = now;
        }
    }

    function getRemainingDowntime(
        ExchangeData.State storage S
        )
        external
        view
        returns (uint duration)
    {
        return S.getNumDowntimeMinutesLeft();
    }

    function stopMaintenanceMode(
        ExchangeData.State storage S
        )
        public
    {
        require(!S.isInWithdrawalMode(), "INVALID_MODE");
        require(!S.isShutdown(), "INVALID_MODE");
        require(S.downtimeStart != 0, "NOT_IN_MAINTENANCE_MODE");

        // Keep a history of how long the exchange has been in maintenance
        S.totalTimeInMaintenanceSeconds = getTotalTimeInMaintenanceSeconds(S);

        // Get the number of downtime minutes left
        S.numDowntimeMinutes = S.getNumDowntimeMinutesLeft();

        // Add an extra fixed cost of 1 minute to mitigate the posibility of abusing
        // the starting/stopping of maintenance mode within a minute or even a single Ethereum block.
        // This is practically the same as rounding down when converting from seconds to minutes.
        if (S.numDowntimeMinutes > 0) {
            S.numDowntimeMinutes -= 1;
        }

        // Stop maintenance mode
        S.downtimeStart = 0;
    }

    function getDowntimeCostLRC(
        ExchangeData.State storage S,
        uint durationMinutes
        )
        public
        view
        returns (uint)
    {
        if(durationMinutes == 0) {
            return 0;
        }

        address costCalculatorAddr = S.loopring.downtimeCostCalculator();
        if (costCalculatorAddr == address(0)) {
            return 0;
        }

        return IDowntimeCostCalculator(costCalculatorAddr).getDowntimeCostLRC(
            S.totalTimeInMaintenanceSeconds,
            now - S.exchangeCreationTimestamp,
            S.numDowntimeMinutes,
            S.loopring.getExchangeStake(S.id),
            durationMinutes
        );
    }

    function getNumDowntimeMinutesLeft(
        ExchangeData.State storage S
        )
        internal // inline call
        view
        returns (uint)
    {
        if (S.downtimeStart == 0) {
            return S.numDowntimeMinutes;
        } else {
            // Calculate how long (in minutes) the exchange is in maintenance
            uint numDowntimeMinutesUsed = now.sub(S.downtimeStart) / 60;
            if (S.numDowntimeMinutes > numDowntimeMinutesUsed) {
                return S.numDowntimeMinutes.sub(numDowntimeMinutesUsed);
            } else {
                return 0;
            }
        }
    }

    function getTotalTimeInMaintenanceSeconds(
        ExchangeData.State storage S
        )
        public
        view
        returns (uint time)
    {
        time = S.totalTimeInMaintenanceSeconds;
        if (S.downtimeStart != 0) {
            if (S.getNumDowntimeMinutesLeft() > 0) {
                time = time.add(now.sub(S.downtimeStart));
            } else {
                time = time.add(S.numDowntimeMinutes.mul(60));
            }
        }
    }
}
