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
pragma solidity ^0.6.6;
pragma experimental ABIEncoderV2;

import "../../lib/MathUint.sol";

import "../../iface/IAddressWhitelist.sol";
import "../../iface/ExchangeData.sol";

import "./ExchangeBalances.sol";


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
    function getAccount(
        ExchangeData.State storage S,
        address owner
        )
        external
        view
        returns (
            uint24 accountID,
            uint   pubKeyX,
            uint   pubKeyY
        )
    {
        accountID = getAccountID(S, owner);
        ExchangeData.Account storage account = S.accounts[accountID];
        pubKeyX = account.pubKeyX;
        pubKeyY = account.pubKeyY;
    }

    function createOrUpdateAccount(
        ExchangeData.State storage S,
        address owner,
        uint    pubKeyX,
        uint    pubKeyY,
        bytes   calldata permission
        )
        external
        returns (
            uint24 accountID,
            bool   isAccountNew,
            bool   isAccountUpdated
        )
    {
        isAccountNew = (S.ownerToAccountId[owner] == 0);
        if (isAccountNew) {
            if (S.addressWhitelist != address(0)) {
                require(
                    IAddressWhitelist(S.addressWhitelist)
                        .isAddressWhitelisted(owner, permission),
                    "ADDRESS_NOT_WHITELISTED"
                );
            }
            accountID = createAccount(S, owner, pubKeyX, pubKeyY);
            isAccountUpdated = false;
        } else {
            (accountID, isAccountUpdated) = updateAccount(S, owner, pubKeyX, pubKeyY);
        }
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

    function createAccount(
        ExchangeData.State storage S,
        address owner,
        uint    pubKeyX,
        uint    pubKeyY
        )
        private
        returns (uint24 accountID)
    {
        require(S.accounts.length < ExchangeData.MAX_NUM_ACCOUNTS(), "ACCOUNTS_FULL");
        require(S.ownerToAccountId[owner] == 0, "ACCOUNT_EXISTS");

        accountID = calculateAccountId(uint24(S.accounts.length));
        ExchangeData.Account memory account = ExchangeData.Account(
            owner,
            pubKeyX,
            pubKeyY
        );

        S.accounts.push(account);
        S.ownerToAccountId[owner] = accountID + 1;

        emit AccountCreated(
            owner,
            accountID,
            pubKeyX,
            pubKeyY
        );
    }

    function calculateAccountId(uint24 accountIdx)
        public
        pure
        returns (uint24 accountID)
    {
        uint24 idx = accountIdx;
        for (uint i = 0; i < 192; i++) {
            accountID = accountID << 1 | (idx & 1);
            idx  = idx >> 1;
        }
    }

    function updateAccount(
        ExchangeData.State storage S,
        address owner,
        uint    pubKeyX,
        uint    pubKeyY
        )
        private
        returns (
            uint24 accountID,
            bool   isAccountUpdated
        )
    {
        require(S.ownerToAccountId[owner] != 0, "ACCOUNT_NOT_EXIST");

        accountID = S.ownerToAccountId[owner] - 1;
        ExchangeData.Account storage account = S.accounts[accountID];

        isAccountUpdated = (account.pubKeyX != pubKeyX || account.pubKeyY != pubKeyY);
        if (isAccountUpdated) {
            account.pubKeyX = pubKeyX;
            account.pubKeyY = pubKeyY;

            emit AccountUpdated(
                owner,
                accountID,
                pubKeyX,
                pubKeyY
            );
        }
    }
}
