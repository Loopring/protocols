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


import "../../iface/modules/ITradeSettlementModule.sol";
import "./AbstractModule.sol";
import "./CanBeDisabled.sol";

// TradeSettlementManager
import "../../iface/IExchangeModuleFactory.sol";
import "./../CircuitManager.sol";


/// @title  TradeSettlementModule
/// @author Brecht Devos - <brecht@loopring.org>
contract TradeSettlementModule is AbstractModule, CanBeDisabled, ITradeSettlementModule
{
    constructor(address exchangeAddress, address vkProviderAddress)
        AbstractModule(exchangeAddress, vkProviderAddress)
        public
    {
        // Get the protocol fees for this exchange
        protocolFeeData.timestamp = uint32(0);
        protocolFeeData.takerFeeBips = loopring.maxProtocolTakerFeeBips();
        protocolFeeData.makerFeeBips = loopring.maxProtocolMakerFeeBips();
        protocolFeeData.previousTakerFeeBips = protocolFeeData.takerFeeBips;
        protocolFeeData.previousMakerFeeBips = protocolFeeData.makerFeeBips;
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

    function processBlock(
        uint32 /*blockSize*/,
        uint16 /*blockVersion*/,
        bytes  memory data,
        bytes  memory /*auxiliaryData*/,
        uint32 /*blockIdx*/
        )
        internal
        whenEnabled
    {
        require(exchange.areUserRequestsEnabled(), "SETTLEMENT_SUSPENDED");

        uint32 inputTimestamp;
        uint8 protocolTakerFeeBips;
        uint8 protocolMakerFeeBips;
        assembly {
            inputTimestamp := and(mload(add(data, 72)), 0xFFFFFFFF)
            protocolTakerFeeBips := and(mload(add(data, 73)), 0xFF)
            protocolMakerFeeBips := and(mload(add(data, 74)), 0xFF)
        }
        require(
            inputTimestamp > now - TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS &&
            inputTimestamp < now + TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS,
            "INVALID_TIMESTAMP"
        );
        require(
            validateAndUpdateProtocolFeeValues(protocolTakerFeeBips, protocolMakerFeeBips),
            "INVALID_PROTOCOL_FEES"
        );
    }

    function validateAndUpdateProtocolFeeValues(
        uint8 takerFeeBips,
        uint8 makerFeeBips
        )
        private
        returns (bool)
    {
        if (now > protocolFeeData.timestamp + MIN_AGE_PROTOCOL_FEES_UNTIL_UPDATED) {
            // Store the current protocol fees in the previous protocol fees
            protocolFeeData.previousTakerFeeBips = protocolFeeData.takerFeeBips;
            protocolFeeData.previousMakerFeeBips = protocolFeeData.makerFeeBips;
            // Get the latest protocol fees for this exchange
            (protocolFeeData.takerFeeBips, protocolFeeData.makerFeeBips) = loopring.getProtocolFeeValues(
                exchangeId,
                onchainDataAvailability
            );
            protocolFeeData.timestamp = uint32(now);

            bool feeUpdated = (protocolFeeData.takerFeeBips != protocolFeeData.previousTakerFeeBips) ||
                (protocolFeeData.makerFeeBips != protocolFeeData.previousMakerFeeBips);

            if (feeUpdated) {
                emit ProtocolFeesUpdated(
                    protocolFeeData.takerFeeBips,
                    protocolFeeData.makerFeeBips,
                    protocolFeeData.previousTakerFeeBips,
                    protocolFeeData.previousMakerFeeBips
                );
            }
        }
        // The given fee values are valid if they are the current or previous protocol fee values
        return (takerFeeBips == protocolFeeData.takerFeeBips && makerFeeBips == protocolFeeData.makerFeeBips) ||
            (takerFeeBips == protocolFeeData.previousTakerFeeBips && makerFeeBips == protocolFeeData.previousMakerFeeBips);
    }
}


/// @title TradeSettlementManager
/// @author Brecht Devos - <brecht@loopring.org>
contract TradeSettlementManager is IExchangeModuleFactory, CircuitManager
{
    function createModule(
        address exchangeAddress
        )
        external
        returns (address)
    {
        // Can deploy the module using a proxy (if supported), cloning,...
        TradeSettlementModule instance = new TradeSettlementModule(exchangeAddress, address(this));
        return address(instance);
    }
}