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

import "../../iface/modules/IOffchainWithdrawalModule.sol";
import "./helpers/WithdrawalModule.sol";


/// @title  OffchainWithdrawalModule
/// @author Brecht Devos - <brecht@loopring.org>
contract OffchainWithdrawalModule is WithdrawalModule, IOffchainWithdrawalModule
{
    constructor(address exchangeAddress, address vkProviderAddress)
        WithdrawalModule(exchangeAddress, vkProviderAddress, 0, 0)
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
        // This module can NEVER be removed (otherwise this module isn't authorized
        // for withdrawing from the exchange anymore which users may still need to do at any time).
        // Use disable() to stop this module from being used for future work.
        return false;
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

    function disable()
        external
        onlyExchangeOwner
    {
        enabled = false;
    }

    // Internal functions

    function processBlock(
        uint32 blockSize,
        uint16 /*blockVersion*/,
        bytes  memory data,
        uint32 blockIdx
        )
        internal
    {
        require(enabled, "MODULE_DISABLED");
        require(!exchange.isShutdown(), "BLOCK_TYPE_NOT_ALLOWED_IN_SHUTDOWN");

        // Store the approved withdrawal data onchain
        bytes memory withdrawals = new bytes(0);
        uint start = 4 + 32 + 32;
        uint length = 7 * blockSize;
        assembly {
            withdrawals := add(data, start)
            mstore(withdrawals, length)
        }

        RequestBlock memory newWithdrawalBlock = RequestBlock(
            blockIdx,
            blockSize,
            uint32(requestBlocks[requestBlocks.length - 1].totalNumRequestsCommitted + blockSize),
            true,
            0,
            withdrawals
        );
        requestBlocks.push(newWithdrawalBlock);
    }
}

