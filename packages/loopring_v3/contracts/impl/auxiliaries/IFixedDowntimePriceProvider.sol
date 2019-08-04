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

import "../../lib/Claimable.sol";

import "../../iface/IDowntimePriceProvider.sol";


/// @title An simple implementation of IDowntimePriceProvider.
/// @author Daniel Wang  - <daniel@loopring.org>
contract IFixedDowntimePriceProvider is IDowntimePriceProvider, Claimable
{
    uint public price;

    event PriceChanged(uint oldPrice, uint newPrice);

    constructor(
        uint _price
        )
        public
    {
        owner = msg.sender;
        price = _price;
    }

    function getDowntimePrice(
        uint  /* totalTimeInMaintenanceSeconds */,
        uint  /* totalDEXLifeTimeSeconds */,
        uint  /* availableDowntimeMinutes */,
        uint  /* amountOfLRCStakedbyOwner */,
        uint  /* durationToPurchaseMinutes */
        )
        external
        view
        returns (uint)
    {
        return price;
    }

    function setPrice(uint _price)
      external
      onlyOwner
    {
        require(_price != price, "SAME_VALUE");
        emit PriceChanged(price, _price);
        price = _price;
    }
}
