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


import "../../iface/modules/IInternalTransferModule.sol";
import "./AbstractModule.sol";
import "./CanBeDisabled.sol";
import "../Authorizable.sol";

import "../../lib/MathUint.sol";

// InternalTransferManager
import "../../iface/IExchangeModuleFactory.sol";
import "./../CircuitManager.sol";


/// @title  InternalTransferModule
/// @author Brecht Devos - <brecht@loopring.org>
contract InternalTransferModule is
    AbstractModule,
    CanBeDisabled,
    Authorizable,
    IInternalTransferModule
{
    using MathUint for uint;

    // The state of a conditional transfer
    struct ConditionalTransferState
    {
        // True if the conditional transfer can be included in a block
        bool    approved;

        // The blockIdx and the Ethereum block number when this conditional transfer was processed
        // (the Ethereum block number is used to detect if the block was reverted)
        uint32  blockIdx;
        uint32  ethereumBlockNumber;
    }

    // A map from the conditional transfer key to the ConditionalTransferState
    mapping (uint => ConditionalTransferState) public conditionalTransfers;

    constructor(address exchangeAddress, address vkProviderAddress)
        AbstractModule(exchangeAddress, vkProviderAddress)
        public
    {
        // Nothing to do
    }

    function onRevert(
        uint blockIdx
        )
        external
        onlyExchange
    {
        // Nothing to do
    }

    function onRemove()
        external
        onlyExchange
        returns (bool)
    {
        // This module can be removed at any time.
        // We cannot know if all conditional transfers can actually be executed
        // (a balance may be insufficient) so there is no guarantee a conditional
        // transfer will be included in a block at any time.
        return true;
    }

    function getStatus()
        external
        view
        returns (bool needsWithdrawalMode, bool hasOpenRequests, uint priority)
    {
        needsWithdrawalMode = false;
        hasOpenRequests = false;
        priority = 0;
    }

    function approveConditionalTransfer(
        address from,
        address to,
        address token,
        uint24  fAmount,
        address feeToken,
        uint24  fFee,
        uint32  salt
        )
        external
        nonReentrant
        whenEnabled
        onlyAuthorizedFor(from)
    {
        uint24 fromAccountID = exchange.getAccountID(from);
        uint24 toAccountID = exchange.getAccountID(from);
        uint16 tokenID = exchange.getTokenID(token);
        uint16 feeTokenID = exchange.getTokenID(feeToken);

        // Same packing as onchain DA + salt
        uint key = fromAccountID;
        key <<= 20;
        key |= toAccountID;
        key <<= 8;
        key |= tokenID;
        key <<= 24;
        key |= fAmount;
        key <<= 8;
        key |= feeTokenID;
        key <<= 16;
        key |= fFee;
        key <<= 8;
        key |= 1;
        key <<= 32;
        key |= salt;

        // Make sure we didn't already approve this conditional transfer
        require(!conditionalTransfers[key].approved, "TRANSFER_ALREADY_APPROVED");
        conditionalTransfers[key] = ConditionalTransferState(
            true,
            0,
            0
        );

        emit ConditionalTransferApproved(
            from,
            to,
            token,
            uint96(uint(fAmount).decodeFloat(24)),
            feeToken,
            uint96(uint(fFee).decodeFloat(16)),
            salt
        );
    }

    function onchainTransferFrom(
        address token,
        address from,
        address to,
        uint    amount
        )
        external
        nonReentrant
        whenEnabled
    {
        exchange.onchainTransferFrom(token, from, to, amount);
    }

    // Internal functions

    function processBlock(
        uint32 /*blockSize*/,
        uint16 /*blockVersion*/,
        bytes  memory data,
        bytes  memory auxiliaryData,
        uint32 blockIdx
        )
        internal
        whenEnabled
    {
        require(!exchange.isShutdown(), "BLOCK_TYPE_NOT_ALLOWED_IN_SHUTDOWN");

        // Read how many conditional transfers are included in the block
        uint numConditionalTransfers;
        assembly {
            numConditionalTransfers := and(mload(add(data, 104)), 0xFFFFFFFF)
        }
        require(auxiliaryData.length == numConditionalTransfers * 6, "INVALID_AUXILIARYDATA");

        uint numBlocks = exchange.getBlockHeight();

        // Run over all conditional transfers
        uint numBytesPerTransfer = 13;
        for (uint i = 0; i < auxiliaryData.length; i += 6) {
            // auxiliaryData contains for each conditional transfer:
            // - Transfer index: 2 bytes (the position of the conditional transfer inside data)
            // - Salt: 4 bytes (the salt of the transfer)
            uint index;
            uint salt;
            assembly {
                index := and(mload(add(auxiliaryData, add(i, 2))), 0xFFFF)
                salt := and(mload(add(auxiliaryData, add(i, 6))), 0xFFFFFFFF)
            }
            uint offset = 104 + index * numBytesPerTransfer;
            uint transferData;
            assembly {
                transferData := and(mload(add(data, offset)), 0xFFFFFFFFFFFFFFFFFFFFFFFFFF)
            }

            // Check that this is a conditional transfer
            require((transferData & 0xFF) == 1, "INVALID_AUXILIARYDATA");

            // The key of the transfer is the combination of the transfer DA data and the salt
            uint key = (transferData << 32) | salt;
            ConditionalTransferState memory transferState = conditionalTransfers[key];
            require(transferState.approved, "TRANSFER_UNAUTHORIZED");

            // Make sure the request was either not used yet, or used in a block that was reverted
            if (transferState.blockIdx != 0 && transferState.blockIdx < numBlocks) {
                // A block exists, but the block could have been changed.
                // Check if the block has a newer Ethereum block number
                require(
                    exchange.getBlock(transferState.blockIdx).ethereumBlockNumber > transferState.ethereumBlockNumber,
                    "TRANSFER_ALREADY_CONSUMED"
                );
            }

            // Update the state
            transferState.blockIdx = blockIdx;
            transferState.ethereumBlockNumber = uint32(block.number);
            conditionalTransfers[key] = transferState;
        }
    }
}


/// @title InternalTransferManager
/// @author Brecht Devos - <brecht@loopring.org>
contract InternalTransferManager is IExchangeModuleFactory, CircuitManager
{
    function createModule(
        address exchangeAddress
        )
        external
        returns (address)
    {
        // Can deploy the module using a proxy (if supported), cloning,...
        InternalTransferModule instance = new InternalTransferModule(exchangeAddress, address(this));
        return address(instance);
    }
}