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

import "./IExchange.sol";
import "./exchangev3/IExchangeV3Accounts.sol";
import "./exchangev3/IExchangeV3Balances.sol";
import "./exchangev3/IExchangeV3Base.sol";
import "./exchangev3/IExchangeV3Blocks.sol";
import "./exchangev3/IExchangeV3Maintenance.sol";
import "./exchangev3/IExchangeV3Modules.sol";
import "./exchangev3/IExchangeV3Staking.sol";
import "./exchangev3/IExchangeV3Tokens.sol";

/// @title IExchangeV3
/// @dev Note that Claimable and ReentrancyGuard are inherited here to
///      ensure all data members are declared on IExchangeV3 to make it
///      easy to support upgradability through proxies.
///
///      Subclasses of this contract must NOT define constructor to
///      initialize data.
///
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
contract IExchangeV3 is
    IExchange,
    IExchangeV3Accounts,
    IExchangeV3Balances,
    IExchangeV3Base,
    IExchangeV3Blocks,
    IExchangeV3Maintenance,
    IExchangeV3Modules,
    IExchangeV3Staking,
    IExchangeV3Tokens
{
}
