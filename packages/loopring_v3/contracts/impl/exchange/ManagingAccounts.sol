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

import "../../iface/exchange/IManagingAccounts.sol";

import "../../iface/IBlockVerifier.sol";
import "../../iface/IExchangeHelper.sol";
import "../../iface/ILoopringV3.sol";

import "../../lib/BurnableERC20.sol";
import "../../lib/ERC20SafeTransfer.sol";
import "../../lib/MathUint.sol";
import "../../lib/NoDefaultFunc.sol";

import "./ManagingBlocks.sol";


/// @title An Implementation of IManagingAccounts.
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
contract ManagingAccounts is IManagingAccounts, ManagingBlocks
{
    // == Public Functions ==
    function getAccount(
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
        accountID = getAccountID(owner);
        Account storage account = accounts[accountID];
        pubKeyX = account.pubKeyX;
        pubKeyY = account.pubKeyY;
    }

    // We do allow pubkeyX and/or pubkeyY to be 0.
    function createOrUpdateAccount(
        uint pubKeyX,
        uint pubKeyY
        )
        public
        payable
        returns (uint24 accountID)
    {
        require(!isInWithdrawMode(), "IN_WITHDRAW_MODE");

        if (ownerToAccountId[msg.sender] == 0) {
            // create a new account
            require(accounts.length < 2 ** 24, "TOO_MANY_ACCOUNTS");
            require(msg.value >= accountCreationFee, "INSUFFICIENT_FEE");

            accountID = uint24(accounts.length);
            Account memory account = Account(
                msg.sender,
                pubKeyX,
                pubKeyY
            );

            accounts.push(account);
            ownerToAccountId[msg.sender] = accountID;
        } else {
            // update an existing account
            require(msg.value >= accountUpdateFee, "INSUFFICIENT_FEE");
            accountID = ownerToAccountId[msg.sender];
             Account storage account = accounts[accountID];

            require(!isFeeRecipientAccount(account), "UPDATE_FEE_RECEPIENT_ACCOUNT_NOT_ALLOWED");
            require(pubKeyX != 0 || pubKeyY !=0, "INVALID_PUBKEY");

            account.pubKeyX = pubKeyX;
            account.pubKeyY = pubKeyY;
        }

        emit AccountUpdated(
            msg.sender,
            accountID,
            pubKeyX,
            pubKeyY
        );
    }

    // == Internal Functions ==
    function getAccountID(
        address owner
        )
        internal
        view
        returns (uint24 accountID)
    {
        require(owner != address(0), "ZERO_ADDRESS");

        accountID = ownerToAccountId[owner];
        require(accountID != 0, "SENDER_HAS_NO_ACCOUNT");
    }

    function verifyAccountBalance(
        bytes32 merkleRoot,
        uint24 accountID,
        uint16 tokenID,
        uint256[24] memory accountPath,
        uint256[12] memory balancePath,
        Account storage account,
        uint32 nonce,
        uint96 balance,
        uint256 tradeHistoryRoot
        )
        internal
    {
        IExchangeHelper(exchangeHelperAddress).verifyAccountBalance(
            uint256(merkleRoot),
            accountID,
            tokenID,
            accountPath,
            balancePath,
            account.pubKeyX,
            account.pubKeyY,
            nonce,
            balance,
            tradeHistoryRoot
        );
    }

    function isFeeRecipientAccount(
        Account storage account
        )
        internal
        view
        returns (bool)
    {
        return account.pubKeyX == 0 && account.pubKeyY == 0;
    }
}