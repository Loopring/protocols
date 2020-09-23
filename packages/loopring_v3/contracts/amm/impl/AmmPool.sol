// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../iface/IAmmPool.sol";
import "./AmmData.sol";
import './LPToken.sol';
import "./libamm/AmmJoinRequest.sol";
import "./libamm/AmmStatus.sol";
import "./libamm/AmmExitRequest.sol";

/// @title AmmPool
abstract contract AmmPool is IAmmPool, LPToken
{
    using AmmJoinRequest   for AmmData.State;
    using AmmStatus        for AmmData.State;
    using AmmExitRequest   for AmmData.State;

    AmmData.State state;

    event Deposit(
        address  owner,
        uint     poolAmount,
        uint96[] amounts
    );

    event JoinPoolRequested(
        address  owner,
        bool     fromLayer2,
        uint     minPoolAmountOut,
        uint96[] maxAmountsIn,
        uint     validUntil
    );

    modifier onlyExchangeOwner()
    {
        require(msg.sender == state.exchange.owner(), "UNAUTHORIZED");
        _;
    }

    modifier online()
    {
        require(state.isOnline(), "NOT_ONLINE");
        _;
    }

    modifier offline()
    {
        require(!state.isOnline(), "NOT_OFFLINE");
        _;
    }

    function isOnline()
        public
        view
        returns (bool)
    {
        return state.isOnline();
    }

    function setupPool(
        IExchangeV3        _exchange,
        uint32             _accountID,
        address[] calldata _tokens,
        uint96[]  calldata _weights,
        uint8              _feeBips
        )
        external
    {
        state.setupPool(_exchange, _accountID, _tokens, _weights, _feeBips);
    }

    /// @param poolAmount The amount of liquidity tokens to deposit
    /// @param amounts The amounts to deposit
    function deposit(
        uint96            poolAmount,
        uint96[] calldata amounts
        )
        external
        payable
        online
    {
        state.deposit(poolAmount, amounts);
    }

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
        external
        online
    {
        state.joinPool(minPoolAmountOut, maxAmountsIn, fromLayer2, validUntil);
    }

    function depositAndJoinPool(
        uint              minPoolAmountOut,
        uint96[] calldata maxAmountsIn,
        bool              fromLayer2,
        uint              validUntil
        )
        external
        online
    {
        state.deposit(0, maxAmountsIn);
        state.joinPool(minPoolAmountOut, maxAmountsIn, fromLayer2, validUntil);
    }
}
