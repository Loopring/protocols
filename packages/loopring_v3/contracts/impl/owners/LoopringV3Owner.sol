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
    ILoopringV3 loopringV3;
    ChainlinkTokenPriceOracle oracle;

    uint public minExchangeStakeWithDataAvailabilityUSD;
    uint public minExchangeStakeWithoutDataAvailabilityUSD;
    uint public revertFineUSD;

    uint public lastUpdateTime;

    uint public constant dampingPeriod = 7 days;

    event LRCValuesUpdated(
        uint minExchangeStakeWithDataAvailabilityLRC,
        uint minExchangeStakeWithoutDataAvailabilityLRC,
        uint revertFineLRC
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
        DelayedOwner(address(loopringV3), 3 minutes)
        public
    {
        loopringV3 = _loopringV3;
        oracle = _oracle;

        setFunctionDelay(loopringV3.transferOwnership.selector, 7 minutes);
        setFunctionDelay(loopringV3.updateSettings.selector, 7 minutes);
        setFunctionDelay(loopringV3.updateProtocolFeeSettings.selector, 7 minutes);

        setFunctionDelay(address(this), LoopringV3Owner(this).setValuesInUSD.selector, 7 minutes);
    }

    function updateValuesInLRC()
        external
    {
        uint minExchangeStakeWithDataAvailabilityLRC = oracle.usd2lrc(minExchangeStakeWithDataAvailabilityUSD);
        uint minExchangeStakeWithoutDataAvailabilityLRC = oracle.usd2lrc(minExchangeStakeWithoutDataAvailabilityUSD);
        uint revertFineLRC = oracle.usd2lrc(revertFineUSD);

        if (now >= lastUpdateTime && lastUpdateTime <= now.add(dampingPeriod)) {
            uint elapsed = now - lastUpdateTime;

            minExchangeStakeWithDataAvailabilityLRC = damp(
                loopringV3.minExchangeStakeWithDataAvailability(),
                minExchangeStakeWithDataAvailabilityLRC,
                elapsed
            );
            minExchangeStakeWithoutDataAvailabilityLRC = damp(
                loopringV3.minExchangeStakeWithoutDataAvailability(),
                minExchangeStakeWithoutDataAvailabilityLRC,
                elapsed
            );
            revertFineLRC = damp(
                loopringV3.revertFineLRC(),
                revertFineLRC,
                elapsed
            );
        }

        loopringV3.updateSettings(
            loopringV3.protocolFeeVault(),
            loopringV3.blockVerifierAddress(),
            loopringV3.downtimeCostCalculator(),
            loopringV3.exchangeCreationCostLRC(),
            loopringV3.maxWithdrawalFee(),
            loopringV3.tokenRegistrationFeeLRCBase(),
            loopringV3.tokenRegistrationFeeLRCDelta(),
            minExchangeStakeWithDataAvailabilityLRC,
            minExchangeStakeWithoutDataAvailabilityLRC,
            revertFineLRC,
            loopringV3.withdrawalFineLRC()
        );

        emit LRCValuesUpdated(
            minExchangeStakeWithDataAvailabilityLRC,
            minExchangeStakeWithoutDataAvailabilityLRC,
            revertFineLRC
        );
    }

    function delayedSetValuesInUSD(
        uint _minExchangeStakeWithDataAvailabilityUSD,
        uint _minExchangeStakeWithoutDataAvailabilityUSD,
        uint _revertFineUSD
        )
        external
        onlyOwner
    {
        bytes memory callData = abi.encodeWithSelector(
            LoopringV3Owner(0).setValuesInUSD.selector,
            _minExchangeStakeWithDataAvailabilityUSD,
            _minExchangeStakeWithoutDataAvailabilityUSD,
            _revertFineUSD
        );
        transactInternal(address(this), 0, callData);
    }

    function setValuesInUSD(
        uint _minExchangeStakeWithDataAvailabilityUSD,
        uint _minExchangeStakeWithoutDataAvailabilityUSD,
        uint _revertFineUSD
        )
        external
        onlyDelayed
    {
        minExchangeStakeWithDataAvailabilityUSD = _minExchangeStakeWithDataAvailabilityUSD;
        minExchangeStakeWithoutDataAvailabilityUSD = _minExchangeStakeWithoutDataAvailabilityUSD;
        revertFineUSD = _revertFineUSD;
    }

    function damp(
        uint value,
        uint newValue,
        uint elapsed
        )
        internal
        pure
        returns (uint)
    {
        return value.mul(dampingPeriod - elapsed).add(
            newValue.mul(elapsed)
        ) / dampingPeriod;
    }
}
