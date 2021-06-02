// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../aux/access/ITransactionReceiver.sol";
import "../core/iface/IAgentRegistry.sol";
import "../lib/ReentrancyGuard.sol";
import "../lib/TransferUtil.sol";
import "./libamm/AmmAssetManagement.sol";
import "./libamm/AmmData.sol";
import "./libamm/AmmExitRequest.sol";
import "./libamm/AmmJoinRequest.sol";
import "./libamm/AmmPoolToken.sol";
import "./libamm/AmmStatus.sol";
import "./libamm/AmmTransactionReceiver.sol";
import "./libamm/AmmWithdrawal.sol";
import "./PoolToken.sol";


/// @title LoopringAmmPool
contract LoopringAmmPool is
    PoolToken,
    IAgent,
    ITransactionReceiver,
    ReentrancyGuard
{
    using AmmAssetManagement     for AmmData.State;
    using AmmJoinRequest         for AmmData.State;
    using AmmExitRequest         for AmmData.State;
    using AmmPoolToken           for AmmData.State;
    using AmmStatus              for AmmData.State;
    using AmmTransactionReceiver for AmmData.State;
    using AmmWithdrawal          for AmmData.State;
    using TransferUtil           for address;

    event PoolJoinRequested(AmmData.PoolJoin join);
    event PoolExitRequested(AmmData.PoolExit exit, bool force);
    event ForcedExitProcessed(address owner, uint96 burnAmount, uint96[] amounts);
    event Shutdown(uint timestamp);

    IAmmController public immutable controller;
    IAssetManager  public immutable assetManager;
    bool           public immutable joinsDisabled;

    modifier onlyFromExchangeOwner()
    {
        require(msg.sender == state.exchangeOwner, "UNAUTHORIZED");
        _;
    }

    modifier onlyFromAssetManager()
    {
        require(msg.sender == address(assetManager), "UNAUTHORIZED");
        _;
    }

    modifier onlyFromController()
    {
        require(msg.sender == address(controller), "UNAUTHORIZED");
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

    constructor(
        IAmmController _controller,
        IAssetManager  _assetManager,
        bool           _joinsDisabled
    )
    {
        controller = _controller;
        assetManager = _assetManager;
        joinsDisabled = _joinsDisabled;
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

    function enableExitMode()
        external
        onlyFromController
    {
        state.exitMode = true;
    }

    // Anyone is able to shut down the pool when requests aren't being processed any more.
    function shutdown(address exitOwner)
        external
        payable
        onlyWhenOnline
        nonReentrant
    {
        state.shutdownByLP(exitOwner);
    }

    function shutdownByController()
        external
        onlyWhenOnline
        nonReentrant
        onlyFromController
    {
        state.shutdownByController();
    }

    function joinPool(
        uint96[]     calldata joinAmounts,
        uint96                mintMinAmount,
        uint96                fee
        )
        external
        payable
        onlyWhenOnline
        nonReentrant
    {
        state.joinPool(joinAmounts, mintMinAmount, fee);
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

    function onReceiveTransactions(
        bytes              calldata txsData,
        bytes              calldata callbackData
        )
        external
        override
        onlyWhenOnline
        onlyFromExchangeOwner
        // nonReentrant     // Not needed, does not do any external calls
                            // and can only be called by the exchange owner.
    {
        AmmData.Settings memory settings = AmmData.Settings({
            controller: controller,
            assetManager: assetManager,
            joinsDisabled: joinsDisabled
        });
        state.onReceiveTransactions(txsData, callbackData, settings);
    }

    function withdrawWhenOffline()
        external
        onlyWhenOffline
        nonReentrant
    {
        state.withdrawWhenOffline();
    }

    function transferOut(
        address to,
        address token,
        uint    amount
        )
        external
        nonReentrant
        onlyFromAssetManager
    {
        state.transferOut(to, token, amount);
    }

    function setBalanceL1(
        address token,
        uint96  balance
        )
        external
        nonReentrant
        onlyFromAssetManager
    {
        state.balancesL1[token] = balance;
    }

    function getBalanceL1(
        address token
        )
        public
        view
        returns (uint96)
    {
        return state.balancesL1[token];
    }
}
