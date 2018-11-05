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
pragma solidity 0.4.24;
pragma experimental "v0.5.0";
pragma experimental "ABIEncoderV2";

import "./ExchangeDeserializer.sol";


/// @title A public library for deserializing loopring submitRings params.
/// @author Daniel Wang - <daniel@loopring.org>,
library PublicExchangeDeserializer {

    address public constant LRC_TOKEN_ADDRESS = 0xEF68e7C694F40c8202821eDF525dE3782458639f;

    function deserialize(
        bytes data
        )
        internal
        view
        returns (
            Data.Mining mining,
            Data.Order[] orders,
            Data.Ring[] rings
        )
    {
        (
            mining,
            orders,
            rings
        ) = ExchangeDeserializer.deserialize(LRC_TOKEN_ADDRESS, data);
    }
}
