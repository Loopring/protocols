// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../lib/Claimable.sol";
import "../lib/Create2.sol";
import "../lib/ReentrancyGuard.sol";
import "../thirdparty/proxies/OwnedUpgradabilityProxy.sol";
import "./LoopringAmmPool.sol";
import "./libamm/AmmData.sol";


contract LoopringAmmFactory is ReentrancyGuard, Claimable
{
    event PoolCreated(AmmData.PoolConfig config, address pool);

    address public immutable poolImplementation;

    constructor(address _poolImplementation)
        Claimable()
    {
        require(_poolImplementation != address(0), "INVALID_IMPL");
        poolImplementation = _poolImplementation;
    }

    function createPool(
        uint salt,
        AmmData.PoolConfig calldata config
        )
        external
        nonReentrant
        returns (address payable pool)
    {
        pool = Create2.deploy(bytes32(salt), type(OwnedUpgradabilityProxy).creationCode);

        OwnedUpgradabilityProxy(pool).transferProxyOwnership(owner);
        OwnedUpgradabilityProxy(pool).upgradeTo(poolImplementation);
        LoopringAmmPool(pool).setupPool(config);

        emit PoolCreated(config, pool);
    }

   function getPoolAddress(uint salt)
        public
        view
        returns (address)
    {
        return Create2.computeAddress(bytes32(salt), type(OwnedUpgradabilityProxy).creationCode);
    }
}