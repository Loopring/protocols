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
        uint timestamp;
        uint value;
        bytes data;
    }

    event TransactionDelayed(
        uint    delayedTransactionIdx,
        uint    timestamp,
        uint    value,
        bytes   data,
        uint    delay
    );

    event TransactionExecuted(
        uint    timestamp,
        uint    value,
        bytes   data
    );

    event DelayedTransactionExecuted(
        uint    delayedTransactionIdx,
        uint    timestamp,
        uint    value,
        bytes   data
    );

    address public contractAddress;
    mapping (bytes4 => uint) public functionDelays;

    Transaction[] public delayedTransactions;

    constructor(
        address _contractAddress
        )
        public
    {
        require(_contractAddress != address(0), "ZERO_ADDRESS");
        contractAddress = _contractAddress;
    }

    function executeDelayedTransaction(
        uint delayedTransactionIdx
        )
        external
        nonReentrant
        onlyOwner
    {
        require(delayedTransactionIdx < delayedTransactions.length, "INVALID_INDEX");
        Transaction storage transaction = delayedTransactions[delayedTransactionIdx];

        // Check if this transaction can still be executed
        require(transaction.timestamp > 0, "TRANSACTION_CONSUMED");

        // Make sure the delay is respected
        bytes4 functionSelector = transaction.data.bytesToBytes4(0);
        uint delay = functionDelays[functionSelector];
        require(now >= transaction.timestamp.add(delay), "TOO_EARLY");

        // Exectute the transaction
        (bool success, bytes memory returnData) = exectuteTransaction(transaction);

        emit DelayedTransactionExecuted(
            delayedTransactionIdx,
            transaction.timestamp,
            transaction.value,
            transaction.data
        );

        // Make the transaction unusable
        disableTransaction(transaction);

        // Return the same data the original transaction would
        // (this will return the data even though this function doesn't have a return vallue in solidity)
        assembly {
            switch success
            case 0 { revert(returnData, mload(returnData)) }
            default { return(returnData, mload(returnData)) }
        }
    }

    function cancelDelayedTransaction(
        uint delayedTransactionIdx
        )
        external
        nonReentrant
        onlyOwner
    {
        require(delayedTransactionIdx < delayedTransactions.length, "INVALID_INDEX");
        Transaction storage transaction = delayedTransactions[delayedTransactionIdx];

        require(transaction.timestamp > 0, "TRANSACTION_CONSUMED");

        // Make the transaction unusable
        disableTransaction(transaction);

        // Return the transaction value (if there is any)
        uint value = transaction.value;
        if (value > 0) {
            msg.sender.sendETHAndVerify(value, gasleft());
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
            now,
            msg.value,
            msg.data
        );

        uint delay = functionDelays[msg.sig];
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
            emit TransactionDelayed(
                delayedTransactions.length - 1,
                transaction.timestamp,
                transaction.value,
                transaction.data,
                delay
            );
        }
    }

    // == Internal Functions ==

    function setFunctionDelay(
        bytes4 functionSelector,
        uint   delay
        )
        internal
    {
        functionDelays[functionSelector] = delay;
    }

    function exectuteTransaction(
        Transaction memory transaction
        )
        internal
        returns (bool success, bytes memory returnData)
    {
        (success, returnData) = contractAddress.call.value(transaction.value)(transaction.data);
    }

    function disableTransaction(
        Transaction storage transaction
        )
        internal
    {
        transaction.timestamp = 0;
    }
}
