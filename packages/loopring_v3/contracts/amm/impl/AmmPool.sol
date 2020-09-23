// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../iface/IAmmPool.sol";
import "./AmmData.sol";
import './LPToken.sol';
import "./libamm/AmmJoin.sol";
import "./libamm/AmmStatus.sol";
import "./libamm/AmmExit.sol";

/// @title AmmPool
abstract contract AmmPool is IAmmPool, LPToken
{
    using AmmJoin   for AmmData.State;
    using AmmStatus for AmmData.State;
    using AmmExit   for AmmData.State;

    AmmData.State state;

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
}
