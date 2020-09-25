// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../aux/access/IBlockReceiver.sol";
import "../core/iface/IAgentRegistry.sol";
import "../lib/ReentrancyGuard.sol";
import "./libamm/AmmBlockReceiver.sol";
import "./libamm/AmmData.sol";
import "./libamm/AmmExchange.sol";
import "./libamm/AmmExitRequest.sol";
import "./libamm/AmmJoinRequest.sol";
import "./libamm/AmmPoolToken.sol";
import "./libamm/AmmStatus.sol";
import './LoopringPoolToken.sol';


/// @title LoopringAmmPool
contract LoopringAmmPool is
    LoopringPoolToken,
    IAgent,
    IBlockReceiver,
    ReentrancyGuard
{
    using AmmBlockReceiver for AmmData.State;
    using AmmExchange      for AmmData.State;
    using AmmExitRequest   for AmmData.State;
    using AmmJoinRequest   for AmmData.State;
    using AmmPoolToken     for AmmData.State;
    using AmmStatus        for AmmData.State;

    event Deposit   (address owner, uint96[] amounts);
    event Withdrawal(address owner, uint[] amountOuts);

    event PoolJoinRequested(AmmData.PoolJoin join);
    event PoolExitRequested(AmmData.PoolExit exit);
    event LockedUntil(address owner, uint timestamp);

    modifier onlyExchangeOwner()
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
    function shutdown(bytes32 txHash)
        external
        payable
        onlyWhenOnline
        nonReentrant
    {
        state.shutdown(txHash);
    }

    // Only used to withdraw from the pool when shutdown.
    // Otherwise LPs should withdraw by doing normal queued exit requests.
    function withdrawFromPoolWhenShutdown(uint poolAmountIn)
        external
        onlyWhenOffline
        nonReentrant
    {
        state.withdrawFromPoolWhenShutdown(poolAmountIn);
    }

    function deposit(uint96[] calldata amounts)
        external
        payable
        onlyWhenOnline
        nonReentrant
    {
        state.depositToPool(amounts);
        emit Deposit(msg.sender, amounts);
    }

    function withdraw(
        uint[] calldata amounts,
        bytes  calldata signature,
        uint            validUntil
        )
        external
        nonReentrant
    {
        uint[] memory amountOuts = state.withdrawFromPool(
            amounts,
            signature,
            validUntil
        );
        emit Withdrawal(msg.sender, amountOuts);
    }

    function joinPool(
        uint              minPoolAmountOut,
        uint96[] calldata maxAmountsIn,
        bool              fromLayer2,
        uint              validUntil
        )
        external
        onlyWhenOnline
        nonReentrant
    {
        AmmData.PoolJoin memory join = state.joinPool(
            minPoolAmountOut,
            maxAmountsIn,
            fromLayer2,
            validUntil
        );
        emit PoolJoinRequested(join);
    }

    function exitPool(
        uint              poolAmountIn,
        uint96[] calldata minAmountsOut,
        bool              toLayer2
        )
        external
        onlyWhenOnline
        nonReentrant
    {
        AmmData.PoolExit memory exit = state.exitPool(
            poolAmountIn,
            minAmountsOut,
            toLayer2
        );
        emit PoolExitRequested(exit);
    }

    function unlock()
        external
        nonReentrant
    {
        uint lockedUntil = state.unlock();
        emit LockedUntil(msg.sender, lockedUntil);
    }

    function beforeBlockSubmitted(
        ExchangeData.Block memory  _block,
        uint                       txIdx,
        bytes              memory  auxiliaryData
        )
        public
        override
        onlyWhenOnline
        onlyExchangeOwner
        nonReentrant
        returns (uint)
    {
        return state.beforeBlockSubmitted(totalSupply(), _block, txIdx, auxiliaryData);
    }
}
