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
pragma solidity 0.5.10;

import "../libexchange/ExchangeData.sol";
import "../libexchange/ExchangeMode.sol";

import "./BaseBlockProcessor.sol";


/// @title TradeSettlementBlock
/// @author Daniel Wang - <daniel@loopring.org>
/// @author Brecht Devos - <brecht@loopring.org>
contract TradeSettlementBlock is BaseBlockProcessor
{
    using ExchangeMode for ExchangeData.State;

    bool public supportOffChainDataAvailability = true;

    event ProtocolFeesUpdated(
        uint8 takerFeeBips,
        uint8 makerFeeBips,
        uint8 previousTakerFeeBips,
        uint8 previousMakerFeeBips
    );

    function commitBlock(
        uint8   blockType,
        uint16  blockSize,
        uint8   blockVersion,
        bytes32 publicDataHash,
        bytes32 merkleRootAfter,
        bytes   memory data // decompressed
        )
        public
    {
        require(state.areUserRequestsEnabled(), "SETTLEMENT_SUSPENDED");
        uint32 inputTimestamp;
        uint8 protocolTakerFeeBips;
        uint8 protocolMakerFeeBips;
        assembly {
            inputTimestamp := and(mload(add(data, 72)), 0xFFFFFFFF)
            protocolTakerFeeBips := and(mload(add(data, 73)), 0xFF)
            protocolMakerFeeBips := and(mload(add(data, 74)), 0xFF)
        }
        require(
            inputTimestamp > now - ExchangeData.TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS() &&
            inputTimestamp < now + ExchangeData.TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS(),
            "INVALID_TIMESTAMP"
        );

        require(
            validateAndUpdateProtocolFeeValues(state, protocolTakerFeeBips, protocolMakerFeeBips),
            "INVALID_PROTOCOL_FEES"
        );

        ExchangeData.Block storage prevBlock = state.blocks[state.blocks.length - 1];

        ExchangeData.Block memory newBlock = ExchangeData.Block(
            merkleRootAfter,
            publicDataHash,
            ExchangeData.BlockState.COMMITTED,
            blockType,
            blockSize,
            blockVersion,
            uint32(now),
            prevBlock.numDepositRequestsCommitted,
            prevBlock.numWithdrawalRequestsCommitted,
            false,
            0,
            new bytes(0)
        );

        state.blocks.push(newBlock);
    }

    function validateAndUpdateProtocolFeeValues(
        ExchangeData.State storage state,
        uint8 takerFeeBips,
        uint8 makerFeeBips
        )
        private
        returns (bool)
    {
        ExchangeData.ProtocolFeeData storage data = state.protocolFeeData;

        if (now > data.timestamp + ExchangeData.MIN_AGE_PROTOCOL_FEES_UNTIL_UPDATED()) {
            // Store the current protocol fees in the previous protocol fees
            data.previousTakerFeeBips = data.takerFeeBips;
            data.previousMakerFeeBips = data.makerFeeBips;
            // Get the latest protocol fees for this exchange
            (data.takerFeeBips, data.makerFeeBips) = state.loopring.getProtocolFeeValues(
                state.id,
                state.onchainDataAvailability
            );
            data.timestamp = uint32(now);

            bool feeUpdated = (data.takerFeeBips != data.previousTakerFeeBips) ||
                (data.makerFeeBips != data.previousMakerFeeBips);

            if (feeUpdated) {
                emit ProtocolFeesUpdated(
                    data.takerFeeBips,
                    data.makerFeeBips,
                    data.previousTakerFeeBips,
                    data.previousMakerFeeBips
                );
            }
        }
        // The given fee values are valid if they are the current or previous protocol fee values
        return (takerFeeBips == data.takerFeeBips && makerFeeBips == data.makerFeeBips) ||
            (takerFeeBips == data.previousTakerFeeBips && makerFeeBips == data.previousMakerFeeBips);
    }
}


