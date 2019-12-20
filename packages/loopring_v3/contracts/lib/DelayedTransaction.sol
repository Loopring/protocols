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

import "../iface/IDelayedTransaction.sol";

import "./AddressUtil.sol";
import "./BytesUtil.sol";
import "./MathUint.sol";
import "./Map.sol";


/// @title DelayedOwner
/// @author Brecht Devos - <brecht@loopring.org>
/// @dev Base class for an Owner contract where certain functions have
///      a mandatory delay for security purposes.
contract DelayedTransaction is IDelayedTransaction
{
    using AddressUtil for address payable;
    using BytesUtil   for bytes;
    using MathUint    for uint;
    using Map         for Map.Data;

    // Map of delayed (delay > 0) functions (DelayedFunction -> delay)
    Map.Data internal delayedFunctions;

    // Map of pending transactions (id -> Transaction)
    Map.Data internal pendingTransactions;

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
        onlyAuthorized
    {
        transactInternal(to, msg.value, data);
    }

    function executeTransaction(
        uint transactionId
        )
        external
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
        onlyAuthorized
    {
        cancelTransactionInternal(transactionId);
    }

    function cancelAllTransactions()
        external
        onlyAuthorized
    {
        // First cache all transactions ids of the transactions we will remove
        uint[] memory transactionIds = new uint[](pendingTransactions.keys.length);
        for(uint i = 0; i < pendingTransactions.keys.length; i++) {
            transactionIds[i] = abi.decode(pendingTransactions.keys[i], (uint));
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
        returns (uint)
    {
        DelayedFunction memory delayedFunction = DelayedFunction(to, functionSelector);
        bytes memory key = encodeDelayedFunction(delayedFunction);
        if (delayedFunctions.contains(key)) {
            return abi.decode(delayedFunctions.get(key), (uint));
        } else {
            return 0;
        }
    }

    function getNumPendingTransactions()
        external
        view
        returns (uint)
    {
        return pendingTransactions.size();
    }

    function getPendingTransaction(
        uint index
        )
        external
        view
        returns (
            uint    id,
            uint    timestamp,
            address to,
            uint    value,
            bytes   memory data
        )
    {
        Transaction memory transaction = decodeTransaction(
            pendingTransactions.get(pendingTransactions.keys[index])
        );
        id = transaction.id;
        timestamp = transaction.timestamp;
        to = transaction.to;
        value = transaction.value;
        data = transaction.data;
    }

    function getNumDelayedFunctions()
        external
        view
        returns (uint)
    {
        return delayedFunctions.size();
    }

    function getDelayedFunction(
        uint index
        )
        external
        view
        returns (
            address to,
            bytes4  functionSelector,
            uint    delay
        )
    {
        DelayedFunction memory delayedFunction = decodeDelayedFunction(delayedFunctions.keys[index]);
        to = delayedFunction.to;
        functionSelector = delayedFunction.functionSelector;
        delay = abi.decode(delayedFunctions.get(delayedFunctions.keys[index]), (uint));
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
            pendingTransactions.set(
                abi.encode(transaction.id),
                encodeTransaction(transaction)
            );
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
        DelayedFunction memory delayedFunction = DelayedFunction(to, functionSelector);
        bytes memory key = encodeDelayedFunction(delayedFunction);
        if (delay > 0) {
            delayedFunctions.set(key, abi.encode(delay));
        } else if (delayedFunctions.contains(key)) {
            delayedFunctions.remove(key);
        }
    }

    function exectuteTransaction(
        Transaction memory transaction
        )
        internal
        returns (bool success, bytes memory returnData)
    {
        // solium-disable-next-line security/no-call-value
        (success, returnData) = transaction.to.call.value(transaction.value)(transaction.data);
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
        returns (Transaction memory transaction)
    {
        transaction = decodeTransaction(
            pendingTransactions.get(abi.encode(transactionId))
        );
    }

    function removeTransaction(
        uint transactionId
        )
        internal
    {
        pendingTransactions.remove(abi.encode(transactionId));
    }

    function encodeTransaction(
        Transaction memory transaction
        )
        internal
        pure
        returns (bytes memory)
    {
        return abi.encode(
            transaction.id,
            transaction.timestamp,
            transaction.to,
            transaction.value,
            transaction.data
        );
    }

    function decodeTransaction(
        bytes memory data
        )
        internal
        pure
        returns (Transaction memory transaction)
    {
        (
            transaction.id,
            transaction.timestamp,
            transaction.to,
            transaction.value,
            transaction.data
        ) = abi.decode(
            data,
            (uint, uint, address, uint, bytes)
        );
    }

    function encodeDelayedFunction(
        DelayedFunction memory delayedFunction
        )
        internal
        pure
        returns (bytes memory)
    {
        return abi.encode(
            delayedFunction.to,
            delayedFunction.functionSelector
        );
    }

    function decodeDelayedFunction(
        bytes memory data
        )
        internal
        pure
        returns (DelayedFunction memory delayedFunction)
    {
        (
            delayedFunction.to,
            delayedFunction.functionSelector
        ) = abi.decode(
            data,
            (address, bytes4)
        );
    }

    function isAuthorizedForTransactions(address sender)
        internal
        view
        returns (bool);
}
