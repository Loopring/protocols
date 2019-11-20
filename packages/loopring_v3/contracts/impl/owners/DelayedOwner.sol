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

import "../../lib/AddressUtil.sol";
import "../../lib/BytesUtil.sol";
import "../../lib/Claimable.sol";
import "../../lib/MathUint.sol";
import "../../lib/ReentrancyGuard.sol";


/// @title DelayedOwner
/// @author Brecht Devos - <brecht@loopring.org>
/// @dev Base class for an Owner contract where certain functions have
///      a mandatory delay for security purposes.
contract DelayedOwner is Claimable, ReentrancyGuard
{
    using AddressUtil for address payable;
    using BytesUtil   for bytes;
    using MathUint    for uint;

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

    event DelayedTransactionExecuted(
        uint    id,
        uint    timestamp,
        uint    value,
        bytes   data
    );

    address public ownedContract;

    // Active list of delayed functions (delay > 0)
    DelayedFunction[] public delayedFunctions;
    // Map from function to the functions's location+1 in the `delayedFunctions` array.
    mapping (bytes4 => uint) public delayedFunctionMap;

    // Active list of delayed transactions
    Transaction[] public delayedTransactions;
    // Map from transaction ID to the transaction's location+1 in the `delayedTransactions` array.
    mapping (uint => uint) public delayedTransactionMap;

    // Used to generate a unique identifier for a delayed transaction
    uint private totalNumDelayedTransactions = 0;

    constructor(
        address _ownedContract
        )
        public
    {
        require(_ownedContract != address(0), "ZERO_ADDRESS");
        ownedContract = _ownedContract;
    }

    function executeDelayedTransaction(
        uint delayedTransactionId
        )
        external
        onlyOwner
    {
        Transaction memory transaction = getDelayedTransaction(delayedTransactionId);

        // Make sure the delay is respected
        bytes4 functionSelector = transaction.data.bytesToBytes4(0);
        uint delay = getFunctionDelay(functionSelector);
        require(now >= transaction.timestamp.add(delay), "TOO_EARLY");

        // Remove the transaction
        removeDelayedTransaction(transaction.id);

        // Exectute the transaction
        (bool success, bytes memory returnData) = exectuteTransaction(transaction);

        emit DelayedTransactionExecuted(
            transaction.id,
            transaction.timestamp,
            transaction.value,
            transaction.data
        );

        // Return the same data the original transaction would
        // (this will return the data even though this function doesn't have a return vallue in solidity)
        assembly {
            switch success
            case 0 { revert(returnData, mload(returnData)) }
            default { return(returnData, mload(returnData)) }
        }
    }

    function cancelDelayedTransaction(
        uint delayedTransactionId
        )
        external
        nonReentrant
        onlyOwner
    {
        cancelDelayedTransactionInternal(delayedTransactionId);
    }

    function cancelAllDelayedTransactions()
        external
        nonReentrant
        onlyOwner
    {
        // First cache all transactions ids of the transactions we will remove
        uint[] memory transactionIds = new uint[](delayedTransactions.length);
        for(uint i = 0; i < delayedTransactions.length; i++) {
            transactionIds[i] = delayedTransactions[i].id;
        }
        // Now remove all delayed transactions
        for(uint i = 0; i < transactionIds.length; i++) {
            cancelDelayedTransactionInternal(transactionIds[i]);
        }
    }

    // If the function that was called has no delay the function is called immediately,
    // otherwise the function call is stored on-chain and can be executed later using
    // `executeDelayedTransaction` when the necessary time has passed.
    function()
        external
        payable
    {
        // Don't do anything if msg.sender isn't the owner (e.g. when receiving ETH)
        if (msg.sender != owner) {
            return;
        }

        Transaction memory transaction = Transaction(
            totalNumDelayedTransactions,
            now,
            msg.value,
            msg.data
        );

        uint delay = getFunctionDelay(msg.sig);
        if (delay == 0) {
            (bool success, bytes memory returnData) = exectuteTransaction(transaction);
            emit TransactionExecuted(
                transaction.timestamp,
                transaction.value,
                transaction.data
            );
            // Return the same data the original transaction would
            // (this will return the data even though this function doesn't have a return vallue in solidity)
            assembly {
                switch success
                case 0 { revert(returnData, mload(returnData)) }
                default { return(returnData, mload(returnData)) }
            }
        } else {
            delayedTransactions.push(transaction);
            delayedTransactionMap[transaction.id] = delayedTransactions.length;
            emit TransactionDelayed(
                transaction.id,
                transaction.timestamp,
                transaction.value,
                transaction.data,
                delay
            );
            totalNumDelayedTransactions++;
        }
    }

    function getFunctionDelay(
        bytes4 functionSelector
        )
        public
        view
        returns (uint)
    {
        uint pos = delayedFunctionMap[functionSelector];
        if (pos == 0) {
            return 0;
        } else {
            return delayedFunctions[pos - 1].delay;
        }
    }

    function getNumDelayedTransactions()
        external
        view
        returns (uint)
    {
        return delayedTransactions.length;
    }

    function getNumDelayedFunctions()
        external
        view
        returns (uint)
    {
        return delayedFunctions.length;
    }

    // == Internal Functions ==

    function setFunctionDelay(
        bytes4 functionSelector,
        uint   delay
        )
        internal
    {
        // Check if the function already has a delay
        uint pos = delayedFunctionMap[functionSelector];
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
                    delayedFunctionMap[lastOne.functionSelector] = pos;
                }
                delayedTransactions.length -= 1;
                delete delayedFunctionMap[functionSelector];
            }
        } else if (delay > 0) {
            // Add the new delayed function
            DelayedFunction memory delayedFunction = DelayedFunction(
                functionSelector,
                delay
            );
            delayedFunctions.push(delayedFunction);
            delayedFunctionMap[functionSelector] = delayedFunctions.length;
        }
    }

    function exectuteTransaction(
        Transaction memory transaction
        )
        internal
        returns (bool success, bytes memory returnData)
    {
        (success, returnData) = ownedContract.call.value(transaction.value)(transaction.data);
    }

    function cancelDelayedTransactionInternal(
        uint delayedTransactionId
        )
        internal
    {
        Transaction storage transaction = getDelayedTransaction(delayedTransactionId);

        // Remove the transaction
        removeDelayedTransaction(transaction.id);

        emit TransactionCancelled(
            transaction.id,
            transaction.timestamp,
            transaction.value,
            transaction.data
        );

        // Return the transaction value (if there is any)
        uint value = transaction.value;
        if (value > 0) {
            msg.sender.sendETHAndVerify(value, gasleft());
        }
    }

    function getDelayedTransaction(
        uint transactionId
        )
        internal
        view
        returns (Transaction storage transaction)
    {
        uint pos = delayedTransactionMap[transactionId];
        require(pos != 0, "TRANSACTION_NOT_FOUND");
        transaction = delayedTransactions[pos - 1];
    }

    function removeDelayedTransaction(
        uint transactionId
        )
        internal
    {
        uint pos = delayedTransactionMap[transactionId];
        require(pos != 0, "TRANSACTION_NOT_FOUND");

        uint size = delayedTransactions.length;
        if (pos != size) {
            Transaction memory lastOne = delayedTransactions[size - 1];
            delayedTransactions[pos - 1] = lastOne;
            delayedTransactionMap[lastOne.id] = pos;
        }

        delayedTransactions.length -= 1;
        delete delayedTransactionMap[transactionId];
    }
}
