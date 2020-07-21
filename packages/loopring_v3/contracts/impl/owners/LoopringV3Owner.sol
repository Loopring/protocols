// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
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
        uint minExchangeStakeRollupLRC,
        uint minExchangeStakeValidiumLRC
    );

    constructor(
        ILoopringV3                _loopringV3,
        ITokenPriceProvider        _provider,
        uint                       _minExchangeStakeRollupUSD,
        uint                       _minExchangeStakeValidiumUSD
        )
        DelayedOwner(address(_loopringV3), 3 days)
        public
    {
        loopringV3 = _loopringV3;
        provider = _provider;
        USD.minExchangeStakeDA = _minExchangeStakeRollupUSD;
        USD.minExchangeStakeWDA = _minExchangeStakeValidiumUSD;

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
            lrcCosts.minExchangeStakeDA,
            lrcCosts.minExchangeStakeWDA
        );

        emit LRCValuesUpdated(
            lrcCosts.minExchangeStakeDA,
            lrcCosts.minExchangeStakeWDA
        );
    }
}
