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

import "../lib/Claimable.sol";


/// @title IDelayedOwner
/// @author Brecht Devos - <brecht@loopring.org>
/// @dev Base class for an Owner contract where certain functions have
///      a mandatory delay for security purposes.
contract IDelayedOwner is Claimable
{
    event TransactionDelayed(
        uint    id,
        uint    timestamp,
        uint    value,
        bytes   data,
        uint    delay
    );

    event TransactionCancelled(
        uint    id,
        uint    timestamp,
        uint    value,
        bytes   data
    );

    event TransactionExecuted(
        uint    timestamp,
        uint    value,
        bytes   data
    );

    event PendingTransactionExecuted(
        uint    id,
        uint    timestamp,
        uint    value,
        bytes   data
    );

    struct Transaction
    {
        uint    id;
        uint    timestamp;
        uint    value;
        bytes   data;
    }

    struct DelayedFunction
    {
        bytes4  functionSelector;
        uint    delay;
    }

    // The contract all function calls will be done on.
    address public ownedContract;

    // The maximum amount of time (in seconds) a pending transaction can be executed
    // (so the amount of time than can pass after the mandatory function specific delay).
    // If the transaction hasn't been executed before then it can be cancelled so it is removed
    // from the pending transaction list.
    uint public timeToLive;

    // Active list of delayed functions (delay > 0)
    DelayedFunction[] public delayedFunctions;

    // Active list of pending transactions
    Transaction[] public pendingTransactions;

    function executeTransaction(
        uint transactionId
        )
        external;

    function cancelTransaction(
        uint transactionId
        )
        external;

    function cancelAllTransactions()
        external;

    function getFunctionDelay(
        bytes4 functionSelector
        )
        public
        view
        returns (uint);

    function getNumPendingTransactions()
        external
        view
        returns (uint);

    function getNumDelayedFunctions()
        external
        view
        returns (uint);
}
