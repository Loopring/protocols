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
pragma solidity ^0.6.6;

import "../iface/IDelayedTransaction.sol";

import "../lib/AddressUtil.sol";
import "../lib/BytesUtil.sol";
import "../lib/MathUint.sol";


/// @title DelayedOwner
/// @author Brecht Devos - <brecht@loopring.org>
/// @dev Base class for an Owner contract where certain functions have
///      a mandatory delay for security purposes.
abstract contract DelayedTransaction is IDelayedTransaction
{
    using AddressUtil for address payable;
    using BytesUtil   for bytes;
    using MathUint    for uint;

    // Map from address and function to the functions's location+1 in the `delayedFunctions` array.
    mapping (address => mapping (bytes4 => uint)) private delayedFunctionMap;

    // Map from transaction ID to the transaction's location+1 in the `pendingTransactions` array.
    mapping (uint => uint) private pendingTransactionMap;

    // Used to generate a unique identifier for a delayed transaction
    uint private totalNumDelayedTransactions = 0;

    modifier onlyAuthorized
    {
        require(isAuthorizedForTransactions(msg.sender), "UNAUTHORIZED");
        _;
    }

    constructor(
        uint    _timeToLive
        )
        public
    {
        timeToLive = _timeToLive;
    }

    // If the function that is called has no delay the function is called immediately,
    // otherwise the function call is stored on-chain and can be executed later using
    // `executeTransaction` when the necessary time has passed.
    function transact(
        address to,
        bytes   calldata data
        )
        external
        payable
        override
        onlyAuthorized
    {
        transactInternal(to, msg.value, data);
    }

    function executeTransaction(
        uint transactionId
        )
        external
        override
        onlyAuthorized
    {
        Transaction memory transaction = getTransaction(transactionId);

        // Make sure the delay is respected
        bytes4 functionSelector = transaction.data.bytesToBytes4(0);
        uint delay = getFunctionDelay(transaction.to, functionSelector);
        require(now >= transaction.timestamp.add(delay), "TOO_EARLY");
        require(now <= transaction.timestamp.add(delay).add(timeToLive), "TOO_LATE");

        // Remove the transaction
        removeTransaction(transaction.id);

        // Exectute the transaction
        (bool success, bytes memory returnData) = exectuteTransaction(transaction);

        emit PendingTransactionExecuted(
            transaction.id,
            transaction.timestamp,
            transaction.to,
            transaction.value,
            transaction.data
        );

        // Return the same data the original transaction would
        // (this will return the data even though this function doesn't have a return value in solidity)
        assembly {
            switch success
            case 0 { revert(add(returnData, 32), mload(returnData)) }
            default { return(add(returnData, 32), mload(returnData)) }
        }
    }

    function cancelTransaction(
        uint transactionId
        )
        external
        override
        onlyAuthorized
    {
        cancelTransactionInternal(transactionId);
    }

    function cancelAllTransactions()
        external
        override
        onlyAuthorized
    {
        // First cache all transactions ids of the transactions we will remove
        uint[] memory transactionIds = new uint[](pendingTransactions.length);
        for(uint i = 0; i < pendingTransactions.length; i++) {
            transactionIds[i] = pendingTransactions[i].id;
        }
        // Now remove all delayed transactions
        for(uint i = 0; i < transactionIds.length; i++) {
            cancelTransactionInternal(transactionIds[i]);
        }
    }

    function getFunctionDelay(
        address to,
        bytes4  functionSelector
        )
        public
        view
        override
        returns (uint)
    {
        uint pos = delayedFunctionMap[to][functionSelector];
        if (pos == 0) {
            return 0;
        } else {
            return delayedFunctions[pos - 1].delay;
        }
    }

    function getNumPendingTransactions()
        external
        view
        override
        returns (uint)
    {
        return pendingTransactions.length;
    }

    function getNumDelayedFunctions()
        external
        view
        override
        returns (uint)
    {
        return delayedFunctions.length;
    }

    // == Internal Functions ==

    function transactInternal(
        address to,
        uint    value,
        bytes   memory data
        )
        internal
    {
        Transaction memory transaction = Transaction(
            totalNumDelayedTransactions,
            now,
            to,
            value,
            data
        );

        bytes4 functionSelector = transaction.data.bytesToBytes4(0);
        uint delay = getFunctionDelay(transaction.to, functionSelector);
        if (delay == 0) {
            (bool success, bytes memory returnData) = exectuteTransaction(transaction);
            emit TransactionExecuted(
                transaction.timestamp,
                transaction.to,
                transaction.value,
                transaction.data
            );
            // Return the same data the original transaction would
            // (this will return the data even though this function doesn't have a return value in solidity)
            assembly {
                switch success
                case 0 { revert(add(returnData, 32), mload(returnData)) }
                default { return(add(returnData, 32), mload(returnData)) }
            }
        } else {
            pendingTransactions.push(transaction);
            pendingTransactionMap[transaction.id] = pendingTransactions.length;
            emit TransactionDelayed(
                transaction.id,
                transaction.timestamp,
                transaction.to,
                transaction.value,
                transaction.data,
                delay
            );
            totalNumDelayedTransactions++;
        }
    }

    function setFunctionDelay(
        address to,
        bytes4  functionSelector,
        uint    delay
        )
        internal
    {
        // Check if the function already has a delay
        uint pos = delayedFunctionMap[to][functionSelector];
        if (pos > 0) {
            if (delay > 0) {
                // Just update the delay
                delayedFunctions[pos - 1].delay = delay;
            } else {
                // Remove the delayed function
                uint size = delayedFunctions.length;
                if (pos != size) {
                    DelayedFunction memory lastOne = delayedFunctions[size - 1];
                    delayedFunctions[pos - 1] = lastOne;
                    delayedFunctionMap[lastOne.to][lastOne.functionSelector] = pos;
                }
                delayedFunctions.pop();
                delete delayedFunctionMap[to][functionSelector];
            }
        } else if (delay > 0) {
            // Add the new delayed function
            DelayedFunction memory delayedFunction = DelayedFunction(
                to,
                functionSelector,
                delay
            );
            delayedFunctions.push(delayedFunction);
            delayedFunctionMap[to][functionSelector] = delayedFunctions.length;
        }
    }

    function exectuteTransaction(
        Transaction memory transaction
        )
        internal
        returns (bool success, bytes memory returnData)
    {
        // solium-disable-next-line security/no-call-value
        (success, returnData) = transaction.to.call{value: transaction.value}(transaction.data);
    }

    function cancelTransactionInternal(
        uint transactionId
        )
        internal
    {
        Transaction memory transaction = getTransaction(transactionId);

        // Remove the transaction
        removeTransaction(transaction.id);

        emit TransactionCancelled(
            transaction.id,
            transaction.timestamp,
            transaction.to,
            transaction.value,
            transaction.data
        );

        // Return the transaction value (if there is any)
        uint value = transaction.value;
        if (value > 0) {
            msg.sender.sendETHAndVerify(value, gasleft());
        }
    }

    function getTransaction(
        uint transactionId
        )
        internal
        view
        returns (Transaction storage transaction)
    {
        uint pos = pendingTransactionMap[transactionId];
        require(pos != 0, "TRANSACTION_NOT_FOUND");
        transaction = pendingTransactions[pos - 1];
    }

    function removeTransaction(
        uint transactionId
        )
        internal
    {
        uint pos = pendingTransactionMap[transactionId];
        require(pos != 0, "TRANSACTION_NOT_FOUND");

        uint size = pendingTransactions.length;
        if (pos != size) {
            Transaction memory lastOne = pendingTransactions[size - 1];
            pendingTransactions[pos - 1] = lastOne;
            pendingTransactionMap[lastOne.id] = pos;
        }

        pendingTransactions.pop();
        delete pendingTransactionMap[transactionId];
    }

    function isAuthorizedForTransactions(address sender)
        internal
        view
        virtual
        returns (bool);
}
