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

    function init(
        IExchangeV3        _exchange,
        uint32             _accountID,
        address[] calldata _tokens,
        uint96[]  calldata _weights,
        uint8              _feeBips,
        string    calldata _tokenName,
        string    calldata _tokenSymbol
        )
        external
        nonReentrant
    {
        require(
            bytes(_tokenName).length > 0 && bytes(_tokenSymbol).length > 0,
            "INVALID_NAME_OR_SYMBOL"
        );
        state.name = _tokenName;
        state.symbol = _tokenSymbol;

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
        state.withdrawFromPoolWhenShutdown(poolAmountIn);
    }

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
