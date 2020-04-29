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

import "../../lib/ERC20.sol";
import "../../lib/ERC20SafeTransfer.sol";
import "../../lib/MathUint.sol";

import "../../iface/IDowntimeCostCalculator.sol";

import "../../iface/ExchangeData.sol";
import "./ExchangeMode.sol";


/// @title ExchangeAdmins.
/// @author Daniel Wang  - <daniel@loopring.org>
/// @author Brecht Devos - <brecht@loopring.org>
library ExchangeAdmins
{
    using MathUint          for uint;
    using ERC20SafeTransfer for address;
    using ExchangeMode      for ExchangeData.State;

    event OperatorChanged(
        uint    indexed exchangeId,
        address         oldOperator,
        address         newOperator
    );

    event AddressWhitelistChanged(
        uint    indexed exchangeId,
        address         oldAddressWhitelist,
        address         newAddressWhitelist
    );

    event FeesUpdated(
        uint    indexed exchangeId,
        uint            accountCreationFeeETH,
        uint            accountUpdateFeeETH,
        uint            depositFeeETH,
        uint            withdrawalFeeETH
    );

    function setOperator(
        ExchangeData.State storage S,
        address payable _operator
        )
        external
        returns (address payable oldOperator)
    {
        require(!S.isInWithdrawalMode(), "INVALID_MODE");
        require(address(0) != _operator, "ZERO_ADDRESS");
        oldOperator = S.operator;
        S.operator = _operator;

        emit OperatorChanged(
            S.id,
            oldOperator,
            _operator
        );
    }

    function setAddressWhitelist(
        ExchangeData.State storage S,
        address _addressWhitelist
        )
        external
        returns (address oldAddressWhitelist)
    {
        require(!S.isInWithdrawalMode(), "INVALID_MODE");
        require(S.addressWhitelist != _addressWhitelist, "SAME_ADDRESS");

        oldAddressWhitelist = S.addressWhitelist;
        S.addressWhitelist = _addressWhitelist;

        emit AddressWhitelistChanged(
            S.id,
            oldAddressWhitelist,
            _addressWhitelist
        );
    }

    function setFees(
        ExchangeData.State storage S,
        uint _accountCreationFeeETH,
        uint _accountUpdateFeeETH,
        uint _depositFeeETH,
        uint _withdrawalFeeETH
        )
        external
    {
        require(!S.isInWithdrawalMode(), "INVALID_MODE");
        require(
            _withdrawalFeeETH <= S.loopring.maxWithdrawalFee(),
            "AMOUNT_TOO_LARGE"
        );

        S.accountCreationFeeETH = _accountCreationFeeETH;
        S.accountUpdateFeeETH = _accountUpdateFeeETH;
        S.depositFeeETH = _depositFeeETH;
        S.withdrawalFeeETH = _withdrawalFeeETH;

        emit FeesUpdated(
            S.id,
            _accountCreationFeeETH,
            _accountUpdateFeeETH,
            _depositFeeETH,
            _withdrawalFeeETH
        );
    }

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
                address feeVault = S.loopring.protocolFeeVault();
                S.lrcAddress.safeTransferFromAndVerify(msg.sender, feeVault, costLRC);
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

    function withdrawExchangeStake(
        ExchangeData.State storage S,
        address recipient
        )
        external
        returns (uint)
    {
        // Exchange needs to be shutdown
        require(S.isShutdown(), "EXCHANGE_NOT_SHUTDOWN");
        // We also require that all deposit requests are processed
        require(
            S.numDepositRequestsCommitted == S.depositChain.length,
            "DEPOSITS_NOT_PROCESSED"
        );
        // Merkle root needs to be reset to the genesis block
        // (i.e. all balances 0 and all other state reset to default values)
        require(S.isInInitialState(), "MERKLE_ROOT_NOT_REVERTED");

        // Withdraw the complete stake
        uint amount = S.loopring.getExchangeStake(S.id);
        return S.loopring.withdrawExchangeStake(S.id, recipient, amount);
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
        if (durationMinutes == 0) {
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
