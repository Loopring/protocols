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

import "./IAbstractModule.sol";
import "./ICanBeDisabled.sol";


/// @title ITradeSettlementModule
/// @author Brecht Devos - <brecht@loopring.org>
contract ITradeSettlementModule is IAbstractModule, ICanBeDisabled
{
    uint public constant MIN_AGE_PROTOCOL_FEES_UNTIL_UPDATED = 1 days;
    uint public constant TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS = 10 minutes;

    event ProtocolFeesUpdated(
        uint8 takerFeeBips,
        uint8 makerFeeBips,
        uint8 previousTakerFeeBips,
        uint8 previousMakerFeeBips
    );

    struct ProtocolFeeData
    {
        uint32 timestamp;
        uint8 takerFeeBips;
        uint8 makerFeeBips;
        uint8 previousTakerFeeBips;
        uint8 previousMakerFeeBips;
    }

    // Cached data for the protocol fee
    ProtocolFeeData public protocolFeeData;
}
