// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../thirdparty/Create2.sol";
import "../lib/OwnerManagable.sol";
import "../lib/SimpleProxy.sol";
import "./LoopringAmmPool.sol";
import "./libamm/AmmData.sol";

contract LoopringAmmFactory is OwnerManagable
{
    event PoolCreated(AmmData.PoolConfig config);

    address public poolImplementation;

    constructor(
        address _poolImplementation
        )
        OwnerManagable()
    {
        poolImplementation = _poolImplementation;
    }

    function createPool(
        AmmData.PoolConfig calldata config
        )
        external
        onlyManager
        returns (address pool)
    {
        pool = address(new SimpleProxy(poolImplementation));
        LoopringAmmPool(pool).setupPool(config);

        emit PoolCreated(config);
    }
}

