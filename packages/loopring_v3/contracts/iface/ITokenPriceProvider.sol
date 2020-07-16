// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Project Ltd (Loopring Foundation).
pragma solidity ^0.6.10;


/// @title ITokenPriceProvider
/// @author Brecht Devos  - <brecht@loopring.org>
interface ITokenPriceProvider
{
    /// @dev Converts USD to LRC
    /// @param usd The amount of USD (10**18 == 1 USD)
    /// @return The amount of LRC
    function usd2lrc(uint usd)
        external
        view
        returns (uint);
}