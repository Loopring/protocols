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

import "../iface/IExchangeV3.sol";

import "./exchangev3/ExchangeV3Accounts.sol";
import "./exchangev3/ExchangeV3Balances.sol";
import "./exchangev3/ExchangeV3Base.sol";
import "./exchangev3/ExchangeV3Blocks.sol";
import "./exchangev3/ExchangeV3Maintenance.sol";
import "./exchangev3/ExchangeV3Modules.sol";
import "./exchangev3/ExchangeV3Staking.sol";
import "./exchangev3/ExchangeV3Tokens.sol";


/// @title An Implementation of IExchangeV3.
/// @dev This contract supports upgradability proxy, therefore its constructor
///      must do NOTHING.
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
contract ExchangeV3 is
    IExchangeV3,
    ExchangeV3Accounts,
    ExchangeV3Balances,
    ExchangeV3Base,
    ExchangeV3Blocks,
    ExchangeV3Maintenance,
    ExchangeV3Modules,
    ExchangeV3Staking,
    ExchangeV3Tokens
{
    /// @dev The constructor must do NOTHING to support proxy.
    constructor() public {}
}
