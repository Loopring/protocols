/*

  Copyright 2017 Loopring Project Ltd (Loopring Foundation).

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/
pragma solidity ^0.5.11;
pragma experimental ABIEncoderV2;


/// @title IDelayedTransaction
/// @author Brecht Devos - <brecht@loopring.org>
contract IDelayedTransaction
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
        payable;

    /// @dev Executes a pending transaction.
    /// @param transactionId The id of the pending transaction.
    function executeTransaction(
        uint transactionId
        )
        external;

    /// @dev Cancels a pending transaction.
    /// @param transactionId The id of the pending transaction.
    function cancelTransaction(
        uint transactionId
        )
        external;

    /// @dev Cancels all pending transactions.
    function cancelAllTransactions()
        external;

    /// @dev Gets the delay for the given function
    /// @param functionSelector The function selector.
    /// @return The delay of the function.
    function getFunctionDelay(
        address to,
        bytes4  functionSelector
        )
        public
        view
        returns (uint);

    /// @dev Gets the number of pending transactions.
    /// @return The number of pending transactions.
    function getNumPendingTransactions()
        external
        view
        returns (uint);

    /// @dev Gets the number of functions that have a delay.
    /// @return The number of delayed functions.
    function getNumDelayedFunctions()
        external
        view
        returns (uint);
}
