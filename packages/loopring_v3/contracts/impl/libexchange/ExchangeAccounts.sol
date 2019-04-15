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
pragma solidity 0.5.7;

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
        uint pubKeyY,
        bool returnFeeSurplus
        )
        public
        returns (
            uint24 accountID,
            bool   isAccountNew
        )
    {
        // normal account cannot have keys to be both 1, this would be a
        // fee recipient account then.
        require(!(pubKeyX == 1 && pubKeyY == 1), "INVALID_PUBKEY");

        // We allow pubKeyX and/or pubKeyY to be 0 for normal accounts to
        // disable offchain request signing.

        isAccountNew = (S.ownerToAccountId[msg.sender] == 0);
        accountID =  isAccountNew ?
            createAccount(S, pubKeyX, pubKeyY, returnFeeSurplus):
            updateAccount(S, pubKeyX, pubKeyY, returnFeeSurplus);
    }

    function createFeeRecipientAccount(
        ExchangeData.State storage S
        )
        public
        returns (uint24 accountID)
    {
        require(S.ownerToAccountId[msg.sender] == 0, "ACCOUNT_EXISTS");
        // use `1` for both pubKeyX and pubKeyY for fee recipient accounts.
        accountID = createAccount(S, 1, 1, false);
    }

    function createAccount(
        ExchangeData.State storage S,
        uint pubKeyX,
        uint pubKeyY,
        bool returnFeeSurplus
        )
        private
        returns (uint24 accountID)
    {
        require(!S.isInWithdrawalMode(), "INVALID_MODE");
        require(S.areUserRequestsEnabled(), "USER_REQUEST_SUSPENDED");
        require(S.accounts.length < ExchangeData.MAX_NUM_ACCOUNTS(), "ACCOUNTS_FULL");

        require(S.ownerToAccountId[msg.sender] == 0, "ACCOUNT_EXISTS");

        require(msg.value >= S.accountCreationFeeETH, "INSUFFICIENT_FEE");

        if (returnFeeSurplus) {
            uint feeSurplus = msg.value.sub(S.accountCreationFeeETH);
            if (feeSurplus > 0) {
                msg.sender.transfer(feeSurplus);
            }
        }

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
        uint pubKeyY,
        bool returnFeeSurplus
        )
        private
        returns (uint24 accountID)
    {
        require(!S.isInWithdrawalMode(), "INVALID_MODE");
        require(S.areUserRequestsEnabled(), "USER_REQUEST_SUSPENDED");

        require(S.ownerToAccountId[msg.sender] != 0, "ACCOUNT_NOT_EXIST");

        require(msg.value >= S.accountUpdateFeeETH, "INSUFFICIENT_FEE");

        if (returnFeeSurplus) {
            uint feeSurplus = msg.value.sub(S.accountUpdateFeeETH);
            if (feeSurplus > 0) {
                msg.sender.transfer(feeSurplus);
            }
        }

        accountID = S.ownerToAccountId[msg.sender];
        ExchangeData.Account storage account = S.accounts[accountID];

        require(!isFeeRecipientAccount(account), "UPDATE_FEE_RECEPIENT_ACCOUNT_NOT_ALLOWED");

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
        uint256[20] memory accountMerkleProof,
        uint256[8]  memory balanceMerkleProof
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
            accountMerkleProof,
            balanceMerkleProof
        );
    }

    function isFeeRecipientAccount(
        ExchangeData.Account storage account
        )
        internal
        view
        returns (bool)
    {
        return account.pubKeyX == 1 && account.pubKeyY == 1;
    }
}