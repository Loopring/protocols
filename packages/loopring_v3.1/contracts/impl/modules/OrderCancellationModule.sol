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

import "../../iface/modules/IOrderCancellationModule.sol";
import "./AbstractModule.sol";
import "./CanBeDisabled.sol";

// OrderCancellationManager
import "../../iface/IExchangeModuleFactory.sol";
import "./../CircuitManager.sol";


/// @title  OrderCancellationModule
/// @author Brecht Devos - <brecht@loopring.org>
contract OrderCancellationModule is AbstractModule, CanBeDisabled, IOrderCancellationModule
{
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
        // This module can be removed at any time
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

    // Internal functions

    /// param `data` for an order cancellation block:
    ///   - Compression type: 1 bytes
    ///   - Exchange ID: 4 bytes
    ///   - Old merkle root: 32 bytes
    ///   - New merkle root: 32 bytes
    ///   - Label hash: 32 bytes
    ///
    /// With on-chain data-availability the following data is appended:
    ///   - Operator account ID: 3 bytes
    ///   - For every cancel:
    ///       - Account ID: 2.5 bytes
    ///       - Order ID: 2.5 bytes
    ///       - Token ID: 1 bytes
    ///       - Fee token ID: 1 bytes
    ///       - Fee amount: 2 bytes
    function processBlock(
        uint32 /*blockSize*/,
        uint16 /*blockVersion*/,
        bytes  memory /*data*/,
        bytes  memory /*auxiliaryData*/,
        uint32 /*blockIdx*/
        )
        internal
        whenEnabled
    {
        require(!exchange.isShutdown(), "BLOCK_TYPE_NOT_ALLOWED_IN_SHUTDOWN");
    }
}


/// @title OrderCancellationManager
/// @author Brecht Devos - <brecht@loopring.org>
contract OrderCancellationManager is IExchangeModuleFactory, CircuitManager
{
    function createModule(
        address exchangeAddress
        )
        external
        returns (address)
    {
        // Can deploy the module using a proxy (if supported), cloning,...
        OrderCancellationModule instance = new OrderCancellationModule(exchangeAddress, address(this));
        return address(instance);
    }
}