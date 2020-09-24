// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

/// @title IAmmPool
interface IAmmPool
{
    /// @param poolAmount The amount of liquidity tokens to deposit
    /// @param amounts The amounts to deposit
    function deposit(
        uint96            poolAmount,
        uint96[] calldata amounts
        )
        external
        payable;

    /// @param poolAmount The amount of liquidity tokens to withdraw
    /// @param amounts The amounts to withdraw
    /// @param validUntil When a signature is provided: the `validUntil` of the signature.
    /// @param signature Signature of the operator to allow withdrawals without unlocking
    function withdraw(
        uint            poolAmount,
        uint[] calldata amounts,
        uint            validUntil,
        bytes  calldata signature
        )
        external;

    /// @dev Joins the pool using on-chain funds.
    /// @param minPoolAmountOut The minimum number of liquidity tokens that need to be minted for this join.
    /// @param maxAmountsIn The maximum amounts that can be used to mint
    ///                     the specified amount of liquidity tokens.
    function joinPool(
        uint              minPoolAmountOut,
        uint96[] calldata maxAmountsIn,
        bool              fromLayer2,
        uint              validUntil
        )
        external;

    function depositAndJoinPool(
        uint              minPoolAmountOut,
        uint96[] calldata maxAmountsIn,
        bool              fromLayer2,
        uint              validUntil
        )
        external;

    function exitPool(
        uint              poolAmountIn,
        uint96[] calldata minAmountsOut,
        bool              toLayer2
        )
        external;
}
