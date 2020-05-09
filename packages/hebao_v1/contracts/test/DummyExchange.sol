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

import "../thirdparty/loopring/IExchangeV3.sol";

contract DummyExchange is IExchangeV3
{

    mapping (address => Account) accountMap;
    uint24 lastAccountId = 0;

    struct Account {
        uint24 accountId;
        uint pubKeyX;
        uint pubKeyY;
    }

    function isInWithdrawalMode()
        external
        override
        view
        returns (bool) {
        return false;
    }

    function isShutdown()
        external
        override
        view
        returns (bool) {
        return false;
    }

    function isInMaintenance()
        external
        override
        view
        returns (bool) {
        return false;
    }

    function getAccount(
        address owner
        )
        external
        override
        view
        returns (
            uint24 accountID,
            uint   pubKeyX,
            uint   pubKeyY
        ) {
        Account memory account = accountMap[owner];
        accountID = account.accountId;
        pubKeyX = account.pubKeyX;
        pubKeyY = account.pubKeyY;
    }

    function createOrUpdateAccount(
        uint  pubKeyX,
        uint  pubKeyY,
        bytes calldata permission
        )
        external
        payable
        override
        returns (
            uint24 accountID,
            bool   isAccountNew,
            bool   isAccountUpdated
        ) {
        if (accountMap[msg.sender].accountId == 0) {
            isAccountNew = true;
            isAccountUpdated = false;
            accountID = lastAccountId + 1;
            accountMap[msg.sender] = Account(accountID, 0, 0);
        } else {
            accountID = accountMap[msg.sender].accountId;
            isAccountNew = false;
            isAccountUpdated = true;
        }

    }

    function updateAccountAndDeposit(
        uint    pubKeyX,
        uint    pubKeyY,
        address tokenAddress,
        uint96  amount,
        bytes   calldata permission
        )
        external
        payable
        override
        returns (
            uint24 accountID,
            bool   isAccountNew,
            bool   isAccountUpdated
        ) {
        if (accountMap[msg.sender].accountId == 0) {
            isAccountNew = true;
            isAccountUpdated = false;
            accountID = lastAccountId + 1;
            accountMap[msg.sender] = Account(accountID, 0, 0);
        } else {
            accountID = accountMap[msg.sender].accountId;
            isAccountNew = false;
            isAccountUpdated = true;
        }
    }

    function deposit(
        address tokenAddress,
        uint96  amount
        )
        external
        payable
        override
    {

    }

    function withdraw(
        address tokenAddress,
        uint96  amount
        )
        external
        payable
        override
    {

    }

    function getFees()
        external
        override
        view
        returns (
            uint _accountCreationFeeETH,
            uint _accountUpdateFeeETH,
            uint _depositFeeETH,
            uint _withdrawalFeeETH
    ) {

    }

    function getRequestStats()
        external
        override
        view
        returns (
            uint numDepositRequestsProcessed,
            uint numAvailableDepositSlots,
            uint numWithdrawalRequestsProcessed,
            uint numAvailableWithdrawalSlots
    ) {

    }

}
