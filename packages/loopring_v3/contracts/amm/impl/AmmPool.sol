// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../iface/IAmmPool.sol";
import "../../aux/access/IBlockReceiver.sol";
import "../../core/iface/IAgentRegistry.sol";
import "./libamm/AmmData.sol";
import './LPToken.sol';
import "./libamm/AmmExchange.sol";
import "./libamm/AmmJoinRequest.sol";
import "./libamm/AmmStatus.sol";
import "./libamm/AmmExitRequest.sol";
import "./libamm/AmmBlockReceiver.sol";
import "../../lib/ReentrancyGuard.sol";

/// @title AmmPool
contract AmmPool is IAmmPool, IAgent, IBlockReceiver, LPToken, ReentrancyGuard
{
    using AmmExchange      for AmmData.State;
    using AmmJoinRequest   for AmmData.State;
    using AmmStatus        for AmmData.State;
    using AmmExitRequest   for AmmData.State;
    using AmmBlockReceiver for AmmData.State;

    AmmData.State state;

    event Deposit(
        address  owner,
        uint     poolAmount,
        uint96[] amounts
    );

    event Withdrawal(
        address   owner,
        uint256[] amounts
    );

    event JoinPoolRequested(
        address  owner,
        bool     fromLayer2,
        uint     minPoolAmountOut,
        uint96[] maxAmountsIn,
        uint     validUntil
    );

    event LockedUntil(
        address  owner,
        uint     timestamp
    );

    event ExitPoolRequested(
        address  owner,
        bool     toLayer2,
        uint     poolAmountIn,
        uint96[] minAmountsOut
    );

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

    function setupPool(
        IExchangeV3        _exchange,
        uint32             _accountID,
        address[] calldata _tokens,
        uint96[]  calldata _weights,
        uint8              _feeBips
        )
        external
        nonReentrant
    {
        state.setupPool(_exchange, _accountID, _tokens, _weights, _feeBips);
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
        uint _totalSupply = totalSupply();
        state.withdrawFromPoolWhenShutdown(poolAmountIn, _totalSupply);
        _burn(msg.sender, poolAmountIn);
    }

    /// @param poolAmount The amount of liquidity tokens to deposit
    /// @param amounts The amounts to deposit
    function deposit(
        uint96            poolAmount,
        uint96[] calldata amounts
        )
        external
        payable
        onlyWhenOnline
        nonReentrant
    {
        state.deposit(poolAmount, amounts);
        emit Deposit(msg.sender, poolAmount, amounts);
    }

    /// @dev Joins the pool using on-chain funds.
    /// @param minPoolAmountOut The minimum number of liquidity tokens that need to be minted for this join.
    /// @param maxAmountsIn The maximum amounts that can be used to mint
    ///                     the specified amount of liquidity tokens.
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
        state.joinPool(minPoolAmountOut, maxAmountsIn, fromLayer2, validUntil);
        emit JoinPoolRequested(
            msg.sender,
            fromLayer2,
            minPoolAmountOut,
            maxAmountsIn,
            validUntil
        );
    }

    function depositAndJoinPool(
        uint              minPoolAmountOut,
        uint96[] calldata maxAmountsIn,
        bool              fromLayer2,
        uint              validUntil
        )
        external
        onlyWhenOnline
        nonReentrant
    {
        state.deposit(0, maxAmountsIn);
        state.joinPool(minPoolAmountOut, maxAmountsIn, fromLayer2, validUntil);
    }

    function setLockedUntil(uint timestamp)
        external
        nonReentrant
    {
        state.setLockedUntil(timestamp);
        emit LockedUntil(msg.sender, timestamp);
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
        state.exitPool(poolAmountIn, minAmountsOut, toLayer2);
        emit ExitPoolRequested(msg.sender, toLayer2, poolAmountIn, minAmountsOut);
    }

    /// @param poolAmount The amount of liquidity tokens to withdraw
    /// @param amounts The amounts to withdraw
    /// @param validUntil When a signature is provided: the `validUntil` of the signature.
    /// @param signature Signature of the operator to allow withdrawals without unlocking
    function withdraw(
        uint            poolAmount,
        uint[] calldata amounts,
        uint            validUntil,
        bytes  calldata signature
        )
        external
        nonReentrant
    {
        uint[] memory withdrawn = state.withdraw(poolAmount, amounts, validUntil, signature);
        emit Withdrawal(msg.sender, withdrawn);
    }

    // Processes work in the queue. Can only be called by the exchange owner
    // before the blocks containing work for this pool are submitted.
    // This just verifies if the work is done correctly and only then approves
    // the L2 transactions that were already included in the block.
    // Uses synchronized logic on L1/L2 to make the onchain logic easy and efficient.
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
        return state.beforeBlockSubmitted(_block, txIdx, auxiliaryData);
    }
}
