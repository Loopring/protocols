// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../../aux/price-providers/ITokenPriceProvider.sol";
import "../../core/iface/ILoopringV3.sol";
import "./DelayedOwner.sol";


/// @title LoopringV3Owner
/// @author Brecht Devos - <brecht@loopring.org>
contract LoopringV3Owner is DelayedOwner
{
    ILoopringV3 public loopringV3;
    ITokenPriceProvider public provider;

    struct Costs
    {
        uint stakePerThousandBlocks;
    }

    Costs public USD;

    event LRCValuesUpdated(
        uint stakePerThousandBlocks
    );

    constructor(
        ILoopringV3                _loopringV3,
        ITokenPriceProvider        _provider,
        uint                       _stakePerThousandBlocksUSD
        )
        DelayedOwner(address(_loopringV3), 3 days)
    {
        loopringV3 = _loopringV3;
        provider = _provider;
        USD.stakePerThousandBlocks = _stakePerThousandBlocksUSD;

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
            provider.usd2lrc(USD.stakePerThousandBlocks)
        );

        // Set the new LRC values on the protocol contract immediately
        loopringV3.updateSettings(
            loopringV3.protocolFeeVault(),
            loopringV3.blockVerifierAddress(),
            loopringV3.exchangeCreationCostLRC(),
            loopringV3.forcedWithdrawalFee(),
            lrcCosts.stakePerThousandBlocks
        );

        emit LRCValuesUpdated(
            lrcCosts.stakePerThousandBlocks
        );
    }
}
