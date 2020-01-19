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

import "../../iface/exchangev3/IExchangeV3Accounts.sol";
import "../libexchange/ExchangeAccounts.sol";

import "./ExchangeV3Core.sol";


/// @title IExchangeV3Accounts
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
contract ExchangeV3Accounts is IExchangeV3Accounts, ExchangeV3Core
{
    using ExchangeAccounts      for ExchangeData.State;

    function getNumAccounts()
        external
        view
        returns (uint)
    {
        return state.accounts.length;
    }

    function createAccount(
        ExchangeData.Account memory account
        )
        public
        nonReentrant
        onlyModule
        returns (uint24)
    {
        return state.createAccount(account);
    }

    function updateAccount(
        ExchangeData.Account memory account
        )
        public
        nonReentrant
        onlyModule
        returns (bool)
    {
        return state.updateAccount(account);
    }

    function getAccount(
        address owner
        )
        external
        view
        returns (ExchangeData.Account memory)
    {
        return state.getAccount(owner);
    }

    function getAccount(
        uint24 accountID
        )
        external
        view
        returns (ExchangeData.Account memory)
    {
        return state.getAccount(accountID);
    }

    function getAccountID(
        address owner
        )
        public
        view
        returns (uint24 accountID)
    {
        return state.getAccountID(owner);
    }

    function hasAccount(
        address owner
        )
        external
        view
        returns (bool)
    {
        return state.hasAccount(owner);
    }
}