// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;


/// @title IDelayedTransaction
/// @author Brecht Devos - <brecht@loopring.org>
abstract contract IDelayedTransaction
{
    event TransactionDelayed(
        uint    id,
        uint    timestamp,
        address to,
        uint    value,
        bytes   data,
        uint    delay
    );

    event TransactionCancelled(
        uint    id,
        uint    timestamp,
        address to,
        uint    value,
        bytes   data
    );

    event TransactionExecuted(
        uint    timestamp,
        address to,
        uint    value,
        bytes   data
    );

    event PendingTransactionExecuted(
        uint    id,
        uint    timestamp,
        address to,
        uint    value,
        bytes   data
    );

    struct Transaction
    {
        uint    id;
        uint    timestamp;
        address to;
        uint    value;
        bytes   data;
    }

    struct DelayedFunction
    {
        address to;
        bytes4  functionSelector;
        uint    delay;
    }

    // The maximum amount of time (in seconds) a pending transaction can be executed
    // (so the amount of time than can pass after the mandatory function specific delay).
    // If the transaction hasn't been executed before then it can be cancelled so it is removed
    // from the pending transaction list.
    uint public timeToLive;

    // Active list of delayed functions (delay > 0)
    DelayedFunction[] public delayedFunctions;

    // Active list of pending transactions
    Transaction[] public pendingTransactions;

    /// @dev Executes a pending transaction.
    /// @param to The contract address to call
    /// @param data The call data
    function transact(
        address to,
        bytes   calldata data
        )
        external
        virtual
        payable;

    /// @dev Executes a pending transaction.
    /// @param transactionId The id of the pending transaction.
    function executeTransaction(
        uint transactionId
        )
        external
        virtual;

    /// @dev Cancels a pending transaction.
    /// @param transactionId The id of the pending transaction.
    function cancelTransaction(
        uint transactionId
        )
        external
        virtual;

    /// @dev Cancels all pending transactions.
    function cancelAllTransactions()
        external
        virtual;

    /// @dev Gets the delay for the given function
    /// @param functionSelector The function selector.
    /// @return The delay of the function.
    function getFunctionDelay(
        address to,
        bytes4  functionSelector
        )
        public
        virtual
        view
        returns (uint);

    /// @dev Gets the number of pending transactions.
    /// @return The number of pending transactions.
    function getNumPendingTransactions()
        external
        virtual
        view
        returns (uint);

    /// @dev Gets the number of functions that have a delay.
    /// @return The number of delayed functions.
    function getNumDelayedFunctions()
        external
        virtual
        view
        returns (uint);
}
