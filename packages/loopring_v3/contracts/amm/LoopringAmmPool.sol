// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../core/iface/IAgentRegistry.sol";
import "../lib/ReentrancyGuard.sol";
import "./libamm/AmmBlockReceiver.sol";
import "./libamm/AmmData.sol";
import "./libamm/AmmExitRequest.sol";
import "./libamm/AmmJoinRequest.sol";
import "./libamm/AmmPoolToken.sol";
import "./libamm/AmmStatus.sol";
import "./libamm/AmmWithdrawal.sol";
import "./libamm/IAmmBlockReceiver.sol";
import './PoolToken.sol';


/// @title LoopringAmmPool
contract LoopringAmmPool is
    PoolToken,
    IAgent,
    IAmmBlockReceiver,
    ReentrancyGuard
{
    using AmmBlockReceiver for AmmData.State;
    using AmmExitRequest   for AmmData.State;
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

    receive() payable external {}

    function setupPool(AmmData.PoolConfig calldata config)
        external
        nonReentrant
    {
        state.setupPool(config);
    }

    // Anyone is able to shut down the pool when requests aren't being processed any more.
    function shutdown(address exitOwner)
        external
        payable
        onlyWhenOnline
        nonReentrant
    {
        state.shutdown(exitOwner);
    }

    function exitPool(
        uint96            burnAmount,
        uint96[] calldata exitMinAmounts
        )
        external
        payable
        onlyWhenOnline
        nonReentrant
    {
        state.exitPool(burnAmount, exitMinAmounts);
    }

    function beforeAllBlocks()
        external
        override
        onlyWhenOnline
        onlyFromExchangeOwner
        nonReentrant
        returns (AmmData.Context memory)
    {
        return state.beforeAllBlocks();
    }

    function afterAllBlocks(AmmData.Context memory ctx)
        external
        override
        onlyWhenOnline
        onlyFromExchangeOwner
        nonReentrant
    {
        state.afterAllBlocks(ctx);
    }

    function beforeEachBlock(
        ExchangeData.Block memory _block,
        AmmData.Context    memory ctx
        )
        external
        override
        onlyWhenOnline
        onlyFromExchangeOwner
        nonReentrant
    {
        state.beforeEachBlock(_block, ctx);
    }

    function onAmmTransaction(
        ExchangeData.Block memory _block,
        AmmData.Context    memory ctx,
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
        return state.onAmmTransaction(ctx, _block, data, txIdx);
    }

    function withdrawFromApprovedWithdrawals()
        external
        nonReentrant
    {
        state.withdrawFromApprovedWithdrawals();
    }

    function withdrawWhenOffline()
        external
        onlyWhenOffline
        nonReentrant
    {
        state.withdrawWhenOffline();
    }
}
