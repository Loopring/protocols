// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../aux/access/ITransactionReceiver.sol";
import "../core/iface/IAgentRegistry.sol";
import "../lib/ReentrancyGuard.sol";
import "../lib/TransferUtil.sol";
import "./libamm/AmmTransactionReceiver.sol";
import "./libamm/AmmData.sol";
import "./libamm/AmmExitRequest.sol";
import "./libamm/AmmJoinRequest.sol";
import "./libamm/AmmPoolToken.sol";
import "./libamm/AmmStatus.sol";
import "./libamm/AmmWithdrawal.sol";
import "./PoolToken.sol";


/// @title LoopringAmmPool
contract LoopringAmmPool is
    PoolToken,
    IAgent,
    ITransactionReceiver,
    ReentrancyGuard
{
    using AmmTransactionReceiver for AmmData.State;
    using AmmJoinRequest         for AmmData.State;
    using AmmExitRequest         for AmmData.State;
    using AmmPoolToken           for AmmData.State;
    using AmmStatus              for AmmData.State;
    using AmmWithdrawal          for AmmData.State;
    using TransferUtil           for address;

    event PoolJoinRequested(AmmData.PoolJoin join);
    event PoolExitRequested(AmmData.PoolExit exit, bool force);
    event ForcedExitProcessed(address owner, uint96 burnAmount, uint96[] amounts);
    event Shutdown(uint timestamp);

    modifier onlyFromExchangeOwner()
    {
        require(msg.sender == state.exchangeOwner, "UNAUTHORIZED");
        _;
    }

    modifier onlyFromInvestor()
    {
        require(msg.sender == state.investor, "UNAUTHORIZED");
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
        state.onReceiveTransactions(txsData, callbackData);
    }

    function withdrawWhenOffline()
        external
        onlyWhenOffline
        nonReentrant
    {
        state.withdrawWhenOffline();
    }

    function depositToExchange(
        address token,
        uint96  amount
        )
        external
        nonReentrant
        onlyWhenOnline
        onlyFromExchangeOwner
    {
        state.deposit(token, amount);
    }

    function withdrawFromExchange(
        address token,
        uint96  amount,
        uint32  storageID
    )
        external
        nonReentrant
        onlyWhenOnline
        onlyFromExchangeOwner
    {
        // We can never allow withdrawing the pool token.
        // All other tokens are fine.
        require(token != address(this), "CANNOT_WITHDRAW_POOL_TOKEN");
        uint16 tokenID = state.exchange.getTokenID(token);

        WithdrawTransaction.Withdrawal memory withdrawal = WithdrawTransaction.Withdrawal({
            from: address(this),
            fromAccountID: state.accountID,
            tokenID: tokenID,
            amount: amount,
            feeTokenID: 0,
            maxFee: 0,
            to: address(this),
            extraData: new bytes(0),
            minGas: 0,
            validUntil: 0xffffffff,
            storageID: storageID,
            // Unused
            withdrawalType: 1,
            onchainDataHash: 0,
            fee: 0
        });
        bytes32 txHash = WithdrawTransaction.hashTx(
            state.exchangeDomainSeparator,
            withdrawal
        );
        state.exchange.approveTransaction(
            address(this),
            txHash
        );
    }

    function transferOut(
        address to,
        address token,
        uint96  amount
        )
        external
        nonReentrant
        onlyWhenOnline
        onlyFromInvestor
    {
        token.transferOut(to, amount);
    }
}
