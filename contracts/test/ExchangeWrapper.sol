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

import "../iface/IRingSubmitter.sol";
import "../impl/PublicExchangeDeserializer.sol";


/// @author Brecht Devos - <brecht@loopring.org>
contract ExchangeWrapper {

    address public ringSubmitterAddress = 0x0;

    // Map of owner allowed to trade
    mapping (address => bool) public whitelist;

    constructor(
        address _ringSubmitterAddress
        )
        public
    {
        ringSubmitterAddress = _ringSubmitterAddress;
    }

    function submitRings(
        bytes data
        )
        external
    {
        (
            ,
            Data.Order[] memory orders,

        ) = PublicExchangeDeserializer.deserialize(data);
        for (uint i = 0; i < orders.length; i++) {
            require(whitelist[orders[i].owner], "OWNER_NOT_WHITELISTED");
        }
        IRingSubmitter(ringSubmitterAddress).submitRings(data);
    }

    function setWhitelisted(
        address owner,
        bool whitelisted
        )
        external
    {
        whitelist[owner] = whitelisted;
    }
}
