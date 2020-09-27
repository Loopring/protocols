// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../lib/Create2.sol";
import "../lib/ReentrancyGuard.sol";
import "../lib/SimpleProxy.sol";
import "./LoopringAmmPool.sol";
import "./libamm/AmmData.sol";


contract LoopringAmmFactory is ReentrancyGuard
{
    event PoolCreated(AmmData.PoolConfig config);

    address public poolImplementation;

    constructor(address _poolImplementation)
    {
        require(_poolImplementation != address(0), "INVALID_IMPL");
        poolImplementation = _poolImplementation;
    }

    function createPool(AmmData.PoolConfig calldata config)
        external
        nonReentrant
        returns (address payable pool)
    {
        bytes32 salt = keccak256(
            abi.encodePacked(
                config.exchange,
                config.poolName,
                config.accountID,
                config.tokens,
                config.weights,
                config.feeBips,
                config.tokenSymbol
            )
        );

        pool = Create2.deploy(salt, type(SimpleProxy).creationCode);

        SimpleProxy(pool).setImplementation(poolImplementation);
        LoopringAmmPool(pool).setupPool(config);

        emit PoolCreated(config);
    }
}