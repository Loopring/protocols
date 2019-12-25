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
import "../../iface/ITokenPriceProvider.sol";


/// @title LoopringV3Owner
/// @author Brecht Devos - <brecht@loopring.org>
contract LoopringV3Owner is DelayedOwner
{
    ILoopringV3 public loopringV3;
    ITokenPriceProvider public provider;

    struct Costs
    {
        uint minExchangeStakeDA;
        uint minExchangeStakeWDA;
        uint revertFine;
    }

    Costs public USD;

    event LRCValuesUpdated(
        uint minExchangeStakeWithDataAvailabilityLRC,
        uint minExchangeStakeWithoutDataAvailabilityLRC,
        uint revertFineLRC
    );

    constructor(
        ILoopringV3                _loopringV3,
        ITokenPriceProvider        _provider,
        uint                       _minExchangeStakeWithDataAvailabilityUSD,
        uint                       _minExchangeStakeWithoutDataAvailabilityUSD,
        uint                       _revertFineUSD
        )
        DelayedOwner(address(_loopringV3), 3 days)
        public
    {
        loopringV3 = _loopringV3;
        provider = _provider;
        USD.minExchangeStakeDA = _minExchangeStakeWithDataAvailabilityUSD;
        USD.minExchangeStakeWDA = _minExchangeStakeWithoutDataAvailabilityUSD;
        USD.revertFine = _revertFineUSD;

        setFunctionDelay(loopringV3.transferOwnership.selector, 7 days);
        setFunctionDelay(loopringV3.updateSettings.selector, 7 days);
        setFunctionDelay(loopringV3.updateProtocolFeeSettings.selector, 7 days);
    }

    /// @dev Updates the costs on the Loopring contract in LRC using the USD values provided.
    ///      Can be called by anyone.
    function updateValuesInLRC()
        external
    {
        // Get the current costs in LRC
        Costs memory lrcCosts = Costs(
            provider.usd2lrc(USD.minExchangeStakeDA),
            provider.usd2lrc(USD.minExchangeStakeWDA),
            provider.usd2lrc(USD.revertFine)
        );

        // Set the new LRC values on the protocol contract immediately
        loopringV3.updateSettings(
            loopringV3.protocolFeeVault(),
            loopringV3.blockVerifierAddress(),
            loopringV3.downtimeCostCalculator(),
            loopringV3.exchangeCreationCostLRC(),
            loopringV3.maxWithdrawalFee(),
            loopringV3.tokenRegistrationFeeLRCBase(),
            loopringV3.tokenRegistrationFeeLRCDelta(),
            lrcCosts.minExchangeStakeDA,
            lrcCosts.minExchangeStakeWDA,
            lrcCosts.revertFine,
            loopringV3.withdrawalFineLRC()
        );

        emit LRCValuesUpdated(
            lrcCosts.minExchangeStakeDA,
            lrcCosts.minExchangeStakeWDA,
            lrcCosts.revertFine
        );
    }
}
