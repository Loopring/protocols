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

import "../lib/Claimable.sol";
import "../lib/ReentrancyGuard.sol";


/// @title IGlobalRegistry
/// @dev This contract manages the all registered ILoopring protocol versions.
/// @author Daniel Wang  - <daniel@loopring.org>
contract IGlobalRegistry is Claimable, ReentrancyGuard
{
    // --- Events ---

    event ProtocolRegistered (
        address indexed protocol,
        address indexed versionManager,
        string          version
    );

    event ProtocolEnabled (
        address indexed protocol
    );

    event ProtocolDisabled (
        address indexed protocol
    );

    event ExchangeForged (
        address indexed loopring,
        address indexed exchangeAddress,
        address         owner,
        bool            supportUpgradability,
        bool            onchainDataAvailability,
        uint            exchangeId,
        uint            amountLRCBurned
    );

    // --- Data ---
    address   public lrcAddress;
    address[] public exchanges;

    // --- Functions ---

    function isExchangeRegistered(
        address exchange
        )
        public
        view
        returns (bool);
}