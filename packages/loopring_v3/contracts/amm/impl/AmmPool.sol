// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../iface/IAmmPool.sol";
import "./AmmData.sol";
import './LPToken.sol';
import "./libamm/AmmJoin.sol";
import "./libamm/AmmExit.sol";

/// @title AmmPool
abstract contract AmmPool is IAmmPool, LPToken
{
    AmmData.State state;
}
