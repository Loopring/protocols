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
pragma solidity 0.5.10;

import "../../lib/MathUint.sol";

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

    function createOrUpdateAccount(
        ExchangeData.State storage S,
        uint  pubKeyX,
        uint  pubKeyY,
        bytes memory permission
        )
        public
        returns (
            uint24 accountID,
            bool   isAccountNew,
            bool   isAccountUpdated
        )
    {
        // We allow pubKeyX and/or pubKeyY to be 0 for normal accounts to
        // disable offchain request signing.

        isAccountNew = (S.ownerToAccountId[msg.sender] == 0);
        if (isAccountNew) {
            if (S.permissionedAccountCreation) {
                require(
                    isPermissionValid(permission, now, msg.sender, S.operator),
                    "INVALID_PERMISSION"
                );
            } else {
                require(permission.length == 0, "NON_EMPTY_SIG");
            }
            accountID = createAccount(S, pubKeyX, pubKeyY);
            isAccountUpdated = false;
        } else {
            require(permission.length == 0, "NON_EMPTY_SIG");
            (accountID, isAccountUpdated) = updateAccount(S, pubKeyX, pubKeyY);
        }
    }

    function createAccount(
        ExchangeData.State storage S,
        uint pubKeyX,
        uint pubKeyY
        )
        private
        returns (uint24 accountID)
    {
        require(S.accounts.length < ExchangeData.MAX_NUM_ACCOUNTS(), "ACCOUNTS_FULL");
        require(S.ownerToAccountId[msg.sender] == 0, "ACCOUNT_EXISTS");

        accountID = uint24(S.accounts.length);
        ExchangeData.Account memory account = ExchangeData.Account(
            msg.sender,
            pubKeyX,
            pubKeyY
        );

        S.accounts.push(account);
        S.ownerToAccountId[msg.sender] = accountID + 1;

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
        private
        returns (
            uint24 accountID,
            bool   isAccountUpdated
        )
    {
        require(S.ownerToAccountId[msg.sender] != 0, "ACCOUNT_NOT_EXIST");

        accountID = S.ownerToAccountId[msg.sender] - 1;
        ExchangeData.Account storage account = S.accounts[accountID];

        isAccountUpdated = (account.pubKeyX != pubKeyX || account.pubKeyY != pubKeyY);
        if (isAccountUpdated) {
            account.pubKeyX = pubKeyX;
            account.pubKeyY = pubKeyY;

            emit AccountUpdated(
                msg.sender,
                accountID,
                pubKeyX,
                pubKeyY
            );
        }
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
        accountID = S.ownerToAccountId[owner];
        require(accountID != 0, "ADDRESS_HAS_NO_ACCOUNT");

        accountID = accountID - 1;
    }

    function isAccountBalanceCorrect(
        ExchangeData.Account storage account,
        bytes32  merkleRoot,
        uint24   accountID,
        uint16   tokenID,
        uint32   nonce,
        uint96   balance,
        uint     tradeHistoryRoot,
        uint[30] memory accountMerkleProof,
        uint[12] memory balanceMerkleProof
        )
        public
        view
    {
        ExchangeBalances.isAccountBalanceCorrect(
            uint(merkleRoot),
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

    function isPermissionValid(
        bytes memory permission,
        uint    currentTime,
        address user,
        address signer
        )
        internal
        pure
        returns (bool)
    {
        uint    t;
        bytes32 r;
        bytes32 s;
        uint8   v;

        if (permission.length != 65 + 8) {
          return false;
        }

        assembly {
          t := mload(add(permission, 8)) // first 64 bits as time in second since epoch
          r := mload(add(permission, 40))
          s := mload(add(permission, 72))
          v := and(mload(add(permission, 73)), 255)
        }

        if (v < 27) {
          v += 27;
        }

        if (v != 27 && v != 28) {
          return false;
        }

        if (t < currentTime - ExchangeData.ACCOUNT_CREATION_PERMISSION_TIMEOUT()){
            return false;
        }

        bytes32 hash = keccak256(abi.encode(
            "LOOPRING_DEX_ACCOUNT_CREATION",
            user,
            t
        ));
        return signer == ecrecover(hash, v, r, s);
    }
}
