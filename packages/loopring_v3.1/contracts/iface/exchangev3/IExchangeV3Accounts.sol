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

import "../../impl/libexchange/ExchangeData.sol";


/// @title IExchangeV3Accounts
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
contract IExchangeV3Accounts
{
    // -- Events --
    // We need to make sure all events defined in ExchangeAccounts.sol
    // are aggregrated here.
    event AccountCreated(
        address indexed owner,
        uint24  indexed id,
        uint            pubKeyX,
        uint            pubKeyY
    );

    event AccountUpdated(
        address indexed owner,
        uint24  indexed id,
        uint            pubKeyX,
        uint            pubKeyY
    );

    /// @dev Creates a new account on the exchange.
    ///      This function is only callable by exchange modules.
    /// @param account The account to create.
    /// @return The account ID
    function createAccount(
        ExchangeData.Account memory account
        )
        public
        returns (uint24);

    /// @dev Updates an existing account on the exchange.
    ///      This function is only callable by exchange modules.
    /// @param account The account to update.
    /// @return True if the account needed updating
    function updateAccount(
        ExchangeData.Account memory account
        )
        public
        returns (bool);

    /// @dev Returns the account of the specified owner.
    /// @param owner The owner of the account
    /// @return The account of the owner
    function getAccount(
        address owner
        )
        external
        view
        returns (ExchangeData.Account memory);

    /// @dev Returns the account of the specified account ID.
    /// @param accountID The account ID of the account
    /// @return The account with the given account ID.
    function getAccount(
        uint24 accountID
        )
        external
        view
        returns (ExchangeData.Account memory);

    /// @dev Returns the account ID of the specified owner.
    /// @param owner The owner of the account
    /// @return The account ID of the owner
    function getAccountID(
        address owner
        )
        public
        view
        returns (uint24 accountID);

    /// @dev Returns if the specified owner has an account on the exchange.
    /// @param owner The owner of the account
    /// @return True if the address has an account on the exchange, else false
    function hasAccount(
        address owner
        )
        external
        view
        returns (bool);

    /// @dev Returns the number of accounts on the exchange
    /// @return The number of accounts on this exchange.
    function getNumAccounts()
        external
        view
        returns (uint);
}
