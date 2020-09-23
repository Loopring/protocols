// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../iface/IAmmPool.sol";
import "./AmmData.sol";
import "./libamm/AmmJoin.sol";
import "./libamm/AmmLPToken.sol";
import "./libamm/AmmExit.sol";

/// @title AmmPool
contract AmmPool is IAmmPool
{
    AmmData.State state;
}
