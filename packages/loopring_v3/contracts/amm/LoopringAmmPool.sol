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

    event Deposit   (address owner, uint96[] amounts);
    event Withdrawal(address owner, uint[] amountOuts);
    event PoolJoinRequested(AmmData.PoolJoin join);
    event PoolExitRequested(AmmData.PoolExit exit);
    event UnlockScheduled(address owner, uint timestamp);
    event Shutdown(uint timestamp);

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

    function joinPool(
        uint96[] calldata joinAmounts,
        uint96[] calldata joinFees,
        bool              joinFromLayer2,
        uint32            joinStorageID,
        uint              mintMinAmount,
        bool              mintToLayer2
        )
        external
        onlyWhenOnline
        nonReentrant
    {
        // TODO(daniel): delete this restriction after phase1
        require(
            joinFromLayer2 == false && mintToLayer2 == false,
            "temporarily disabled in phase1"
        );
        state.joinPool(
            joinAmounts,
            joinFees,
            joinFromLayer2,
            joinStorageID,
            mintMinAmount,
            mintToLayer2
        );
    }

    function exitPool(
        uint              burnAmount,
        bool              burnFromLayer2,
        uint32            burnStorageID,
        uint96[] calldata exitMinAmounts,
        bool              exitToLayer2
        )
        external
        onlyWhenOnline
        nonReentrant
    {
        // TODO(daniel): delete this restriction after phase1
        require(
            exitToLayer2 == false && burnFromLayer2 == false,
            "temporarily disabled in phase1"
        );

        state.exitPool(
            burnAmount,
            burnFromLayer2,
            burnStorageID,
            exitMinAmounts,
            exitToLayer2
        );
    }

    function beforeBlockSubmission(
        ExchangeData.Block calldata _block,
        uint                        txIdx,
        bytes              calldata auxiliaryData
        )
        external
        override
        onlyWhenOnline
        onlyExchangeOwner
        nonReentrant
        returns (uint)
    {
        return state.beforeBlockSubmission(_block, txIdx, auxiliaryData);
    }

    function afterBlockSubmission(
        ExchangeData.Block calldata _block
        )
        external
        override
        onlyWhenOnline
        onlyExchangeOwner
        nonReentrant
    {
        state.afterBlockSubmission(_block);
    }

        // Only used to withdraw from the pool when shutdown.
    // Otherwise LPs should withdraw by doing normal queued exit requests.
    function withdrawFromPoolWhenShutdown(uint burnAmount)
        external
        onlyWhenOffline
        nonReentrant
    {
        state.withdrawFromPoolWhenShutdown(burnAmount);
    }
}
