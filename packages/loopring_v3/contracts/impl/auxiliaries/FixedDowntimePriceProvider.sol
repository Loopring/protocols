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
import "../../lib/MathUint.sol";

import "../../iface/IDowntimePriceProvider.sol";


/// @title An simple implementation of IDowntimePriceProvider.
/// @author Daniel Wang  - <daniel@loopring.org>
contract FixedDowntimePriceProvider is IDowntimePriceProvider, Claimable
{
    using MathUint for uint;

    uint public price;
    uint public maxDowntime;

    event SettingsChanged(uint oldPrice, uint oldMaxDowntime);

    constructor(
        uint _price,
        uint _maxDowntime
        )
        public
    {
        price = _price;
        maxDowntime = _maxDowntime;
        owner = msg.sender;
    }

    function getDowntimePrice(
        uint  /* totalTimeInMaintenanceSeconds */,
        uint  /* totalDEXLifeTimeSeconds */,
        uint  numDowntimeMinutes,
        uint  /* exchangeStakedLRC */,
        uint  durationToPurchaseMinutes
        )
        external
        view
        returns (uint)
    {
        if (numDowntimeMinutes.add(durationToPurchaseMinutes) > maxDowntime) {
            return 0; // disable purchasing
        } else {
            return price;
        }
    }

    function updateSettings(
        uint _price,
        uint _maxDowntime
        )
        external
        onlyOwner
    {
        require(_price != price || _maxDowntime != maxDowntime, "SAME_VALUES");

        emit SettingsChanged(price, maxDowntime);

        price = _price;
        maxDowntime = _maxDowntime;
    }
}
