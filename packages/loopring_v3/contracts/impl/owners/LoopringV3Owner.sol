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

import "./DelayedOwner.sol";
import "../../iface/ILoopringV3.sol";

import "./ChainlinkTokenPriceOracle.sol";


/// @title LoopringV3Owner
/// @author Brecht Devos - <brecht@loopring.org>
contract LoopringV3Owner is DelayedOwner
{
    uint public constant NUM_MOVING_AVERAGE_DATA_POINTS = 7;
    uint public constant MOVING_AVERAGE_TIME_PERIOD = 1 days;

    ILoopringV3 public loopringV3;
    ChainlinkTokenPriceOracle public oracle;

    struct Costs
    {
        uint minExchangeStakeDA;
        uint minExchangeStakeWDA;
        uint revertFine;
    }

    bool public initialized = false;

    Costs public USD;
    Costs[] public LRC;

    uint public lastUpdateTime;
    uint internal updateIndex = 0;

    event LRCValuesUpdated(
        uint minExchangeStakeWithDataAvailabilityLRC,
        uint minExchangeStakeWithoutDataAvailabilityLRC,
        uint revertFineLRC
    );

    constructor(
        ILoopringV3                _loopringV3,
        ChainlinkTokenPriceOracle  _oracle,
        uint                       _minExchangeStakeWithDataAvailabilityUSD,
        uint                       _minExchangeStakeWithoutDataAvailabilityUSD,
        uint                       _revertFineUSD
        )
        DelayedOwner(address(_loopringV3), 3 days)
        public
    {
        loopringV3 = _loopringV3;
        oracle = _oracle;
        USD.minExchangeStakeDA = _minExchangeStakeWithDataAvailabilityUSD;
        USD.minExchangeStakeWDA = _minExchangeStakeWithoutDataAvailabilityUSD;
        USD.revertFine = _revertFineUSD;

        setFunctionDelay(loopringV3.transferOwnership.selector, 7 days);
        setFunctionDelay(loopringV3.updateSettings.selector, 7 days);
        setFunctionDelay(loopringV3.updateProtocolFeeSettings.selector, 7 days);
    }

    /// @dev Claims ownership of the protocol contract and initializes the data
    function claimOwnershipAndInitialize()
        external
    {
        require(!initialized, "ALREADY_INITIALIZED");

        // Claim ownership of the Loopring contract
        loopringV3.claimOwnership();

        // Fill in the initial data points with the current LRC costs
        Costs memory currentLrcCosts = Costs(
            loopringV3.minExchangeStakeWithDataAvailability(),
            loopringV3.minExchangeStakeWithoutDataAvailability(),
            loopringV3.revertFineLRC()
        );
        for (uint i = 0; i < NUM_MOVING_AVERAGE_DATA_POINTS; i++) {
            LRC.push(currentLrcCosts);
        }
        lastUpdateTime = now;

        initialized = true;
    }

    /// @dev Updates the costs on the Loopring contract in LRC using the USD values provided.
    ///      Can be called by anyone a single time every day.
    ///      The LRC values set are calculated using a simple moving average.
    function updateValuesInLRC()
        external
    {
        require(initialized, "NOT_INITIALIZED");

        // Allow the costs to be updated every time span
        require(now >= lastUpdateTime.add(MOVING_AVERAGE_TIME_PERIOD), "TOO_SOON");

        // Get the current LRC amounts
        Costs memory currentLrcCosts = Costs(
            oracle.usd2lrc(USD.minExchangeStakeDA),
            oracle.usd2lrc(USD.minExchangeStakeWDA),
            oracle.usd2lrc(USD.revertFine)
        );
        // Use the LRC array as a circular buffer
        LRC[updateIndex] = currentLrcCosts;
        updateIndex = (updateIndex + 1) % NUM_MOVING_AVERAGE_DATA_POINTS;

        // Calculate the simple moving average over `numMovingAverageDataPoints` points
        Costs memory movingAverage;
        for (uint i = 0; i < NUM_MOVING_AVERAGE_DATA_POINTS; i++) {
            movingAverage.minExchangeStakeDA = movingAverage.minExchangeStakeDA.add(LRC[i].minExchangeStakeDA);
            movingAverage.minExchangeStakeWDA = movingAverage.minExchangeStakeWDA.add(LRC[i].minExchangeStakeWDA);
            movingAverage.revertFine = movingAverage.revertFine.add(LRC[i].revertFine);
        }
        movingAverage.minExchangeStakeDA /= NUM_MOVING_AVERAGE_DATA_POINTS;
        movingAverage.minExchangeStakeWDA /= NUM_MOVING_AVERAGE_DATA_POINTS;
        movingAverage.revertFine /= NUM_MOVING_AVERAGE_DATA_POINTS;

        lastUpdateTime = now;

        // Set the new LRC values on the protocol contract immediately
        loopringV3.updateSettings(
            loopringV3.protocolFeeVault(),
            loopringV3.blockVerifierAddress(),
            loopringV3.downtimeCostCalculator(),
            loopringV3.exchangeCreationCostLRC(),
            loopringV3.maxWithdrawalFee(),
            loopringV3.tokenRegistrationFeeLRCBase(),
            loopringV3.tokenRegistrationFeeLRCDelta(),
            movingAverage.minExchangeStakeDA,
            movingAverage.minExchangeStakeWDA,
            movingAverage.revertFine,
            loopringV3.withdrawalFineLRC()
        );

        emit LRCValuesUpdated(
            movingAverage.minExchangeStakeDA,
            movingAverage.minExchangeStakeWDA,
            movingAverage.revertFine
        );
    }
}
