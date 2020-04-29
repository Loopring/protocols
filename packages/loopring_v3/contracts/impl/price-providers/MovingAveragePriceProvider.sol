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

import "../../iface/ITokenPriceProvider.sol";

import "../../lib/MathUint.sol";


/// @author Brecht Devos - <brecht@loopring.org>
contract MovingAveragePriceProvider is ITokenPriceProvider
{
    using MathUint    for uint;

    ITokenPriceProvider public provider;

    uint public movingAverageTimePeriod;
    uint public numMovingAverageDataPoints;
    uint public defaultValue;

    uint public lastUpdateTime;

    uint[] internal history;
    uint internal movingAverage;
    uint internal updateIndex;

    event MovingAverageUpdated(
        uint timestamp,
        uint defaultValueUSD,
        uint movingAverageLRC
    );

    constructor(
        ITokenPriceProvider _provider,
        uint                _movingAverageTimePeriod,
        uint                _numMovingAverageDataPoints,
        uint                _defaultValue
        )
        public
    {
        require(_movingAverageTimePeriod > 0, "INVALID_INPUT");
        require(_numMovingAverageDataPoints > 0, "INVALID_INPUT");
        require(_defaultValue > 0, "INVALID_INPUT");

        provider = _provider;
        movingAverageTimePeriod = _movingAverageTimePeriod;
        numMovingAverageDataPoints = _numMovingAverageDataPoints;
        defaultValue = _defaultValue;

        // Fill in the initial data points with the current LRC costs
        uint currentConversion = provider.usd2lrc(defaultValue);
        for (uint i = 0; i < numMovingAverageDataPoints; i++) {
            history.push(currentConversion);
        }
        movingAverage = currentConversion;
        lastUpdateTime = now;
    }

    function usd2lrc(uint usd)
        external
        view
        override
        returns (uint)
    {
        return usd.mul(movingAverage) / defaultValue;
    }

    /// @dev Updates the simple moving average.
    ///      Can be called by anyone a single time every day.
    function updateMovingAverage()
        external
    {
        // Allow the costs to be updated every time span
        require(now >= lastUpdateTime.add(movingAverageTimePeriod), "TOO_SOON");

        // Get the current price. Use the history array as a circular buffer
        history[updateIndex] = provider.usd2lrc(defaultValue);
        updateIndex = (updateIndex + 1) % numMovingAverageDataPoints;

        // Calculate the simple moving average over `numMovingAverageDataPoints` points
        uint newMovingAverage = 0;
        for (uint i = 0; i < numMovingAverageDataPoints; i++) {
            newMovingAverage = newMovingAverage.add(history[i]);
        }
        movingAverage = newMovingAverage / numMovingAverageDataPoints;

        lastUpdateTime = now;

        emit MovingAverageUpdated(now, defaultValue, movingAverage);
    }
}
