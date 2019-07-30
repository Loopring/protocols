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
pragma solidity 0.5.7;

import "../../iface/IBlockProcessor.sol";

/// @title IBlockProcessor
/// @author Freeman Zhong - <kongliang@loopring.org>
contract RingSettlementProcessor is IBlockProcessor
{

    event ProtocolFeesUpdated(
        uint8 takerFeeBips,
        uint8 makerFeeBips,
        uint8 previousTakerFeeBips,
        uint8 previousMakerFeeBips
    );

    function processBlock(
        uint16 blockSize,
        uint8  blockVersion,
        bytes calldata data
        )
        external
    {
        require(S.areUserRequestsEnabled(), "SETTLEMENT_SUSPENDED");
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
            validateAndUpdateProtocolFeeValues(S, protocolTakerFeeBips, protocolMakerFeeBips),
            "INVALID_PROTOCOL_FEES"
        );

    }

}
