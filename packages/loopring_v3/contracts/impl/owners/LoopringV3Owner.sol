// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Project Ltd (Loopring Foundation).
pragma solidity ^0.6.10;

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
    }

    Costs public USD;

    event LRCValuesUpdated(
        uint minExchangeStakeWithDataAvailabilityLRC,
        uint minExchangeStakeWithoutDataAvailabilityLRC
    );

    constructor(
        ILoopringV3                _loopringV3,
        ITokenPriceProvider        _provider,
        uint                       _minExchangeStakeWithDataAvailabilityUSD,
        uint                       _minExchangeStakeWithoutDataAvailabilityUSD
        )
        DelayedOwner(address(_loopringV3), 3 days)
        public
    {
        loopringV3 = _loopringV3;
        provider = _provider;
        USD.minExchangeStakeDA = _minExchangeStakeWithDataAvailabilityUSD;
        USD.minExchangeStakeWDA = _minExchangeStakeWithoutDataAvailabilityUSD;

        setFunctionDelay(loopringV3.transferOwnership.selector, 7 days);
        setFunctionDelay(loopringV3.updateSettings.selector, 7 days);
        setFunctionDelay(loopringV3.updateProtocolFeeSettings.selector, 7 days);
    }

    /// @dev Updates the costs on the Loopring contract in LRC using the USD values provided.
    ///      Can be called by anyone.
    function updateValuesInLRC()
        external
        nonReentrant
    {
        // Get the current costs in LRC
        Costs memory lrcCosts = Costs(
            provider.usd2lrc(USD.minExchangeStakeDA),
            provider.usd2lrc(USD.minExchangeStakeWDA)
        );

        // Set the new LRC values on the protocol contract immediately
        loopringV3.updateSettings(
            loopringV3.protocolFeeVault(),
            loopringV3.blockVerifierAddress(),
            loopringV3.exchangeCreationCostLRC(),
            loopringV3.forcedWithdrawalFee(),
            loopringV3.tokenRegistrationFeeLRCBase(),
            loopringV3.tokenRegistrationFeeLRCDelta(),
            lrcCosts.minExchangeStakeDA,
            lrcCosts.minExchangeStakeWDA
        );

        emit LRCValuesUpdated(
            lrcCosts.minExchangeStakeDA,
            lrcCosts.minExchangeStakeWDA
        );
    }
}
