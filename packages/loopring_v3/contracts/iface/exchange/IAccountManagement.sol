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


/// @title An Implementation of IDEX.
/// @author Daniel Wang  - <daniel@loopring.org>
contract IAccountManagement
{
    // == Events ==

    event Deposit(
        uint32 depositIdx,
        uint24 accountID,
        uint16 tokenID,
        uint96 amount
    );

    event Withdraw(
        uint24 accountID,
        uint16 tokenID,
        address to,
        uint96 amount
    );

    event WithdrawRequest(
        uint32 withdrawBlockIdx,
        uint16 slotIdx,
        uint24 accountID,
        uint16 tokenID,
        uint96 amount
    );

    struct Account
    {
        address owner;
        bool   withdrawn;
        uint   publicKeyX;
        uint   publicKeyY;
    }

    // == Public Constants ==

    // Default account
    uint public constant DEFAULT_ACCOUNT_PUBLICKEY_X = 2760979366321990647384327991146539505488430080750363450053902718557853404165;
    uint public constant DEFAULT_ACCOUNT_PUBLICKEY_Y = 10771439851340068599303586501499035409517957710739943668636844002715618931667;
    uint public constant DEFAULT_ACCOUNT_SECRETKEY   = 531595266505639429282323989096889429445309320547115026296307576144623272935;

    // == Internal Functions ==

    function createDefaultAccount()
        internal;

    function getAccount(
        uint24 accountID
        )
        internal
        view
        returns (Account storage account);

    function isFeeRecipientAccount(
        Account storage account
        )
        internal
        view
        returns (bool);

    // == Public Functions ==

    function getAccountID()
        public
        view
        returns (uint24 accountID);

    function createAccount(
        uint publicKeyX,
        uint publicKeyY,
        uint16 tokenID,
        uint96 amount
        )
        public
        payable
        returns (uint24);

    function updateAccount(
        uint publicKeyX,
        uint publicKeyY,
        uint16 tokenID,
        uint96 amount
        )
        public
        payable;

    function deposit(
        uint16 tokenID,
        uint96 amount
        )
        external
        payable;

    function withdraw(
        uint16 tokenID,
        uint96 amount
        )
        external
        payable;
}