// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../aux/access/IBlockReceiver.sol";
import "../core/iface/IAgentRegistry.sol";
import "../lib/ReentrancyGuard.sol";
import "./libamm/AmmBlockReceiver.sol";
import "./libamm/AmmData.sol";
import "./libamm/AmmExitRequest.sol";
import "./libamm/AmmJoinRequest.sol";
import "./libamm/AmmPoolToken.sol";
import "./libamm/AmmStatus.sol";
import "./libamm/AmmWithdrawal.sol";
import './PoolToken.sol';


/// @title LoopringAmmPool
contract LoopringAmmPool is
    PoolToken,
    IAgent,
    IBlockReceiver,
    ReentrancyGuard
{
    using AmmBlockReceiver for AmmData.State;
    using AmmExitRequest   for AmmData.State;
    using AmmJoinRequest   for AmmData.State;
    using AmmPoolToken     for AmmData.State;
    using AmmStatus        for AmmData.State;
    using AmmWithdrawal    for AmmData.State;

    event PoolExitRequested(AmmData.PoolExit exit);
    event Shutdown(uint timestamp);

    modifier onlyFromExchangeOwner()
    {
        require(msg.sender == state.exchange.owner(), "UNAUTHORIZED");
        _;
    }

    modifier onlyWhenOnline()
    {
        require(state.isOnline(), "NOT_ONLINE");
        _;
    }

    modifier onlyWhenOffline()
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

    function constants()
        public
        pure
        returns(
            uint poolTokenInitialSupply,
            uint maxForcedExitAge,
            uint maxForcedExitCount
        )
    {
        poolTokenInitialSupply = AmmData.POOL_TOKEN_INITIAL_SUPPLY();
        maxForcedExitAge = AmmData. MAX_FORCED_EXIT_AGE();
        maxForcedExitCount = AmmData.MAX_FORCED_EXIT_COUNT();
    }

    receive() payable external {}

    function setupPool(AmmData.PoolConfig calldata config)
        external
        nonReentrant
    {
        state.setupPool(config);
    }

    // Anyone is able to shut down the pool when requests aren't being processed any more.
    function shutdown(bytes32 exitHash)
        external
        payable
        onlyWhenOnline
        nonReentrant
    {
        state.shutdown(exitHash);
    }

    function exitPool(
        uint96            burnAmount,
        uint96[] calldata exitMinAmounts
        )
        external
        onlyWhenOnline
        nonReentrant
    {
        state.exitPool(burnAmount, exitMinAmounts);
    }

    function beforeBlockSubmission(
        ExchangeData.Block memory _block,
        bytes              memory data,
        uint                      txIdx
        )
        external
        override
        onlyWhenOnline
        onlyFromExchangeOwner
        nonReentrant
        returns (uint)
    {
        return state.beforeBlockSubmission(_block, data, txIdx);
    }

    function withdrawInShutdown()
        external
        onlyWhenOffline
        nonReentrant
    {
        state.withdrawInShutdown();
    }
}
