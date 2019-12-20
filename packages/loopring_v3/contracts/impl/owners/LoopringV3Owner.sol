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
    uint public constant numMovingAverageDataPoints = 7;

    ILoopringV3 public loopringV3;
    ChainlinkTokenPriceOracle public oracle;

    struct Costs
    {
        uint minExchangeStakeDA;
        uint minExchangeStakeNDA;
        uint revertFine;
    }

    Costs public USD;
    Costs[] public LRC;

    uint public lastUpdateTime;
    uint internal updateIndex = 0;

    event LRCValuesUpdated(
        uint minExchangeStakeWithDataAvailabilityLRC,
        uint minExchangeStakeWithoutDataAvailabilityLRC,
        uint revertFineLRC
    );

    event USDValuesUpdated(
        uint minExchangeStakeWithDataAvailabilityUSD,
        uint minExchangeStakeWithoutDataAvailabilityUSD,
        uint revertFineUSD
    );

    modifier onlyDelayed
    {
        require(msg.sender == address(this), "UNAUTHORIZED");
        _;
    }

    constructor(
        ILoopringV3                _loopringV3,
        ChainlinkTokenPriceOracle  _oracle
        )
        DelayedOwner(address(_loopringV3), 3 days)
        public
    {
        loopringV3 = _loopringV3;
        oracle = _oracle;

        setFunctionDelay(loopringV3.transferOwnership.selector, 7 days);
        setFunctionDelay(loopringV3.updateSettings.selector, 7 days);
        setFunctionDelay(loopringV3.updateProtocolFeeSettings.selector, 7 days);

        setFunctionDelay(address(this), LoopringV3Owner(this).setValuesInUSD.selector, 7 days);

        // Fill in the initial data points with the current LRC costs
        Costs memory currentLrcCosts = Costs(
            loopringV3.minExchangeStakeWithDataAvailability(),
            loopringV3.minExchangeStakeWithoutDataAvailability(),
            loopringV3.revertFineLRC()
        );
        for (uint i = 0; i < numMovingAverageDataPoints; i++) {
            LRC.push(currentLrcCosts);
        }
        lastUpdateTime = now;
    }

    function updateValuesInLRC()
        external
    {
        // Allow the values to be updated every day
        require(lastUpdateTime <= now.add(1 days), "TOO_SOON");

        // Get the current LRC amounts
        Costs memory currentLrcCosts = Costs(
            oracle.usd2lrc(USD.minExchangeStakeDA),
            oracle.usd2lrc(USD.minExchangeStakeNDA),
            oracle.usd2lrc(USD.revertFine)
        );
        // Use the LRC array as a circular buffer
        LRC[updateIndex] = currentLrcCosts;
        updateIndex = (updateIndex + 1) % numMovingAverageDataPoints;

        // Calculate the simple moving average over `numMovingAverageDataPoints` points
        Costs memory movingAverage;
        for (uint i = 0; i < numMovingAverageDataPoints; i++) {
            movingAverage.minExchangeStakeDA = movingAverage.minExchangeStakeDA.add(LRC[i].minExchangeStakeDA);
            movingAverage.minExchangeStakeNDA = movingAverage.minExchangeStakeNDA.add(LRC[i].minExchangeStakeNDA);
            movingAverage.revertFine = movingAverage.revertFine.add(LRC[i].revertFine);
        }
        movingAverage.minExchangeStakeDA /= numMovingAverageDataPoints;
        movingAverage.minExchangeStakeNDA /= numMovingAverageDataPoints;
        movingAverage.revertFine /= numMovingAverageDataPoints;

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
            movingAverage.minExchangeStakeNDA,
            movingAverage.revertFine,
            loopringV3.withdrawalFineLRC()
        );

        emit LRCValuesUpdated(
            movingAverage.minExchangeStakeDA,
            movingAverage.minExchangeStakeNDA,
            movingAverage.revertFine
        );
    }

    function setDelayedValuesInUSD(
        uint minExchangeStakeWithDataAvailabilityUSD,
        uint minExchangeStakeWithoutDataAvailabilityUSD,
        uint revertFineUSD
        )
        external
        onlyOwner
    {
        // Allow setting the values immediately if they are not yet initialized
        if (USD.minExchangeStakeDA == 0 &&
            USD.minExchangeStakeNDA == 0 &&
            USD.revertFine == 0) {
            setValuesInUSDInternal(
                minExchangeStakeWithDataAvailabilityUSD,
                minExchangeStakeWithoutDataAvailabilityUSD,
                revertFineUSD
            );
        } else {
            bytes memory callData = abi.encodeWithSelector(
                LoopringV3Owner(0).setValuesInUSD.selector,
                minExchangeStakeWithDataAvailabilityUSD,
                minExchangeStakeWithoutDataAvailabilityUSD,
                revertFineUSD
            );
            transactInternal(address(this), 0, callData);
        }
    }

    function setValuesInUSD(
        uint minExchangeStakeDAUSD,
        uint minExchangeStakeNDAUSD,
        uint revertFineUSD
        )
        external
        onlyDelayed
    {
        setValuesInUSDInternal(
            minExchangeStakeDAUSD,
            minExchangeStakeNDAUSD,
            revertFineUSD
        );
    }

    function setValuesInUSDInternal(
        uint minExchangeStakeWithDataAvailabilityUSD,
        uint minExchangeStakeWithoutDataAvailabilityUSD,
        uint revertFineUSD
        )
        internal
    {
        USD.minExchangeStakeDA = minExchangeStakeWithDataAvailabilityUSD;
        USD.minExchangeStakeNDA = minExchangeStakeWithoutDataAvailabilityUSD;
        USD.revertFine = revertFineUSD;

        emit USDValuesUpdated(
            USD.minExchangeStakeDA,
            USD.minExchangeStakeNDA,
            USD.revertFine
        );
    }
}
