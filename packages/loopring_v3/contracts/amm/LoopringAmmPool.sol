// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../aux/access/IBlockReceiver.sol";
import "../core/iface/IAgentRegistry.sol";
// import "../lib/Drainable.sol";
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
    // Drainable,
    ReentrancyGuard
{
    using AmmBlockReceiver for AmmData.State;
    using AmmJoinRequest   for AmmData.State;
    using AmmExitRequest   for AmmData.State;
    using AmmPoolToken     for AmmData.State;
    using AmmStatus        for AmmData.State;
    using AmmWithdrawal    for AmmData.State;

    event PoolJoinRequested(AmmData.PoolJoin join);
    event ForcedPoolExitRequested(AmmData.PoolExit exit, bool force);
    event ForcedExitProcessed(address owner, uint96 burnAmount, uint96[] amounts);
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

    function joinPool(
        uint96[]     calldata joinAmounts,
        uint96                mintMinAmount
        )
        external
        payable
        onlyWhenOnline
        nonReentrant
    {
        state.joinPool(joinAmounts, mintMinAmount);
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
        state.exitPool(burnAmount, exitMinAmounts, false);
    }

    function forceExitPool(
        uint96            burnAmount,
        uint96[] calldata exitMinAmounts
        )
        external
        payable
        onlyWhenOnline
        nonReentrant
    {
        state.exitPool(burnAmount, exitMinAmounts, true);
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

    // function withdrawFromDepositRequests(
    //     address[] calldata tokens
    //     )
    //     external
    //     nonReentrant
    // {
    //     state.withdrawFromDepositRequests(tokens);
    // }

    // function withdrawFromApprovedWithdrawals()
    //     external
    //     nonReentrant
    // {
    //     state.withdrawFromApprovedWithdrawals();
    // }

    function withdrawWhenOffline()
        external
        onlyWhenOffline
        nonReentrant
    {
        state.withdrawWhenOffline();
    }

    // function canDrain(address drainer, address token)
    //     public
    //     override
    //     view
    //     returns (bool)
    // {
    //     return state.canDrain(drainer, token);
    // }
}
