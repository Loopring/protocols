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

import "../../lib/MathUint.sol";

import "../../iface/IAddressWhitelist.sol";

import "./ExchangeBalances.sol";
import "./ExchangeData.sol";


/// @title ExchangeAccounts.
/// @author Daniel Wang  - <daniel@loopring.org>
/// @author Brecht Devos - <brecht@loopring.org>
library ExchangeAccounts
{
    using MathUint          for uint;
    using ExchangeBalances  for ExchangeData.State;

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

    // == Public Functions ==
    function createAccount(
        ExchangeData.State storage S,
        ExchangeData.Account memory account
        )
        public
        returns (uint24 accountID)
    {
        require(S.accounts.length < ExchangeData.MAX_NUM_ACCOUNTS(), "ACCOUNTS_FULL");
        require(S.ownerToAccountId[account.owner] == 0, "ACCOUNT_EXISTS");
        require(account.id == uint24(S.accounts.length), "INVALID_ACCOUNT_ID");

        S.accounts.push(account);
        S.ownerToAccountId[account.owner] = accountID + 1;

        emit AccountCreated(
            account.owner,
            account.id,
            account.pubKeyX,
            account.pubKeyY
        );

        accountID = account.id;
    }

    function updateAccount(
        ExchangeData.State storage S,
        ExchangeData.Account memory updatedAccount
        )
        public
        returns (bool isAccountUpdated)
    {
        require(S.ownerToAccountId[updatedAccount.owner] != 0, "ACCOUNT_NOT_EXIST");

        uint24 accountID = S.ownerToAccountId[updatedAccount.owner] - 1;
        require(updatedAccount.id == uint24(S.accounts.length), "INVALID_ACCOUNT_ID");

        ExchangeData.Account storage account = S.accounts[accountID];

        isAccountUpdated = (account.pubKeyX != updatedAccount.pubKeyX || account.pubKeyY != updatedAccount.pubKeyY);
        if (isAccountUpdated) {
            account.pubKeyX = updatedAccount.pubKeyX;
            account.pubKeyY = updatedAccount.pubKeyY;

            emit AccountUpdated(
                account.owner,
                accountID,
                account.pubKeyX,
                account.pubKeyY
            );
        }
    }

    function getAccount(
        ExchangeData.State storage S,
        address owner
        )
        external
        view
        returns (ExchangeData.Account memory account)
    {
        uint24 accountID = getAccountID(S, owner);
        account = S.accounts[accountID];
    }

    function getAccount(
        ExchangeData.State storage S,
        uint24 accountID
        )
        external
        view
        returns (ExchangeData.Account memory account)
    {
        account = S.accounts[accountID];
    }

    function getAccountID(
        ExchangeData.State storage S,
        address owner
        )
        public
        view
        returns (uint24 accountID)
    {
        accountID = S.ownerToAccountId[owner];
        require(accountID != 0, "ADDRESS_HAS_NO_ACCOUNT");

        accountID = accountID - 1;
    }

    function hasAccount(
        ExchangeData.State storage S,
        address owner
        )
        external
        view
        returns (bool)
    {
        return S.ownerToAccountId[owner] > 0;
    }
}
