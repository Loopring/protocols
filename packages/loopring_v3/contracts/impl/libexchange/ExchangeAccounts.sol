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
pragma solidity 0.5.2;

import "../../lib/BurnableERC20.sol";
import "../../lib/ERC20SafeTransfer.sol";
import "../../lib/MathUint.sol";

import "./ExchangeAccounts.sol";
import "./ExchangeBalances.sol";
import "./ExchangeData.sol";
import "./ExchangeMode.sol";


/// @title ExchangeAccounts.
/// @author Daniel Wang  - <daniel@loopring.org>
/// @author Brecht Devos - <brecht@loopring.org>
library ExchangeAccounts
{
    using MathUint          for uint;
    using ExchangeMode      for ExchangeData.State;
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
        public
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

    // We do allow pubkeyX and/or pubkeyY to be 0.
    function createOrUpdateAccount(
        ExchangeData.State storage S,
        uint pubKeyX,
        uint pubKeyY
        )
        public
        returns (
            uint24 accountID,
            bool   isAccountNew
        )
    {
        isAccountNew = (S.ownerToAccountId[msg.sender] == 0);
        if (isAccountNew) {
            accountID = createAccount(S, pubKeyX, pubKeyY);
        } else {
            accountID = updateAccount(S, pubKeyX, pubKeyY);
        }
    }

    function createAccount(
        ExchangeData.State storage S,
        uint pubKeyX,
        uint pubKeyY
        )
        internal
        returns (uint24 accountID)
    {
        require(!S.isInWithdrawalMode(), "INVALID_MODE");
        require(now >= S.disableUserRequestsUntil, "USER_REQUEST_SUSPENDED");

        require(S.ownerToAccountId[msg.sender] == 0, "ACCOUNT_EXISTS");

        require(S.accounts.length < 2 ** 24, "TOO_MANY_ACCOUNTS");
        require(msg.value >= S.accountCreationFeeETH, "INSUFFICIENT_FEE");

        accountID = uint24(S.accounts.length);
        ExchangeData.Account memory account = ExchangeData.Account(
            msg.sender,
            pubKeyX,
            pubKeyY
        );

        S.accounts.push(account);
        S.ownerToAccountId[msg.sender] = accountID;

        emit AccountCreated(
            msg.sender,
            accountID,
            pubKeyX,
            pubKeyY
        );
    }

    function updateAccount(
        ExchangeData.State storage S,
        uint pubKeyX,
        uint pubKeyY
        )
        internal
        returns (uint24 accountID)
    {
        require(!S.isInWithdrawalMode(), "INVALID_MODE");
        require(now >= S.disableUserRequestsUntil, "USER_REQUEST_SUSPENDED");

        require(S.ownerToAccountId[msg.sender] != 0, "ACCOUNT_NOT_EXIST");

        require(msg.value >= S.accountUpdateFeeETH, "INSUFFICIENT_FEE");
        accountID = S.ownerToAccountId[msg.sender];
        ExchangeData.Account storage account = S.accounts[accountID];

        require(!isFeeRecipientAccount(account), "UPDATE_FEE_RECEPIENT_ACCOUNT_NOT_ALLOWED");
        require(pubKeyX != 0 || pubKeyY != 0, "INVALID_PUBKEY");

        account.pubKeyX = pubKeyX;
        account.pubKeyY = pubKeyY;

        emit AccountUpdated(
            msg.sender,
            accountID,
            pubKeyX,
            pubKeyY
        );
    }

    // == Internal Functions ==
    function getAccountID(
        ExchangeData.State storage S,
        address owner
        )
        internal
        view
        returns (uint24 accountID)
    {
        require(owner != address(0), "ZERO_ADDRESS");

        accountID = S.ownerToAccountId[owner];
        require(accountID != 0, "SENDER_HAS_NO_ACCOUNT");
    }

    function isAccountBalanceCorrect(
        ExchangeData.Account storage account,
        bytes32 merkleRoot,
        uint24 accountID,
        uint16 tokenID,
        uint32 nonce,
        uint96 balance,
        uint256 tradeHistoryRoot,
        uint256[24] memory accountPath,
        uint256[12] memory balancePath
        )
        public
        view
    {
        ExchangeBalances.isAccountBalanceCorrect(
            uint256(merkleRoot),
            accountID,
            tokenID,
            account.pubKeyX,
            account.pubKeyY,
            nonce,
            balance,
            tradeHistoryRoot,
            accountPath,
            balancePath
        );
    }

    function isFeeRecipientAccount(
        ExchangeData.Account storage account
        )
        internal
        view
        returns (bool)
    {
        return account.pubKeyX == 0 && account.pubKeyY == 0;
    }
}