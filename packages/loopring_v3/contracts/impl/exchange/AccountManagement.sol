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

import "../../iface/exchange/IAccountManagement.sol";
import "../../iface/exchange/ITokenRegistration.sol";
import "./Base.sol";

import "../../iface/ILoopringV3.sol";

import "../../iface/IBlockVerifier.sol";
import "../../iface/IExchangeHelper.sol";

import "../../lib/BurnableERC20.sol";
import "../../lib/ERC20SafeTransfer.sol";
import "../../lib/MathUint.sol";
import "../../lib/NoDefaultFunc.sol";


/// @title An Implementation of IDEX.
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
contract AccountManagement is IAccountManagement, ITokenRegistration, Base
{
    // == Private Variables ==

    Account[] accounts;
    mapping (address => uint24) ownerToAccountId;

    // == Public Functions ==

    function getAccountID()
        public
        view
        returns (uint24 accountID)
    {
        accountID = ownerToAccountId[msg.sender];
        // Default account is at ID 0, which cannot be used
        require(accountID != 0, "SENDER_HAS_NO_ACCOUNT");
    }

    function createAccount(
        uint publicKeyX,
        uint publicKeyY,
        uint16 tokenID,
        uint96 amount
        )
        public
        payable
        returns (uint24)
    {
        require(accounts.length < 2 ** 24, "TOO_MANY_ACCOUNTS");

        Account memory account = Account(
            msg.sender,
            false,
            publicKeyX,
            publicKeyY
        );
        accounts.push(account);

        uint24 accountID = uint24(accounts.length - 1);

        require(ownerToAccountId[msg.sender] == 0, "SENDER_ALREADY_HAS_AN_ACCOUNT");
        ownerToAccountId[msg.sender] = accountID;

        updateAccount(
            publicKeyX,
            publicKeyY,
            tokenID,
            amount
        );

        return accountID;
    }

    function deposit(
        uint16 tokenID,
        uint96 amount
        )
        external
        payable
    {
        Account storage account = getAccount(getAccountID());
        updateAccount(
            account.publicKeyX,
            account.publicKeyY,
            tokenID,
            amount
        );
    }

    function updateAccount(
        uint publicKeyX,
        uint publicKeyY,
        uint16 tokenID,
        uint96 amount
        )
        public
        payable
    {
        // Realm cannot be in withdraw mode
        require(!isInWithdrawMode(), "IN_WITHDRAW_MODE");
        require(getNumAvailableDepositSlots() > 0, "TOO_MANY_REQUESTS");

        uint24 accountID = getAccountID();
        Account storage account = getAccount(accountID);

        // Update account info
        if (!isFeeRecipientAccount(account)) {
            account.publicKeyX = publicKeyX;
            account.publicKeyY = publicKeyY;
        } else {
            require(amount == 0, "CANNOT_DEPOSIT_TO_FEE_RECIPIENT_ACCOUNTS");
        }

        // Check expected ETH value sent, can be larger than the minimum depos
        uint depositFee = 0;
        if (tokenID != 0) {
            require(msg.value >= minimumDepositFee, "INVALID_VALUE");
            depositFee = msg.value;
        } else {
            require(msg.value >= (minimumDepositFee.add(amount)), "INVALID_VALUE");
            depositFee = msg.value - amount;
        }

        // Add the request to the deposit chain
        Request storage previousRequest = depositChain[depositChain.length - 1];
        Request memory request = Request(
            sha256(
                abi.encodePacked(
                    previousRequest.accumulatedHash,
                    accountID,
                    publicKeyX,
                    publicKeyY,
                    uint24(0),
                    tokenID,
                    amount
                )
            ),
            previousRequest.accumulatedFee.add(depositFee),
            uint32(now)
        );
        depositChain.push(request);

        // Transfer the tokens from the owner into this contract
        address tokenAddress = getTokenAddress(tokenID);
        if (amount > 0 && tokenID != 0) {
            require(
                tokenAddress.safeTransferFrom(
                    account.owner,
                    address(this),
                    amount
                ),
                "INSUFFICIENT_FUND"
            );
        }

        // Store deposit info onchain so we can withdraw from uncommitted deposit blocks
        DepositRequest memory depositRequest = DepositRequest(
            accountID,
            tokenID,
            amount
        );
        depositRequests.push(depositRequest);

        emit Deposit(uint32(depositRequests.length - 1), accountID, tokenID, amount);
    }

    // Set the large value for amount to withdraw the complete balance
    function withdraw(
        uint16 tokenID,
        uint96 amount
        )
        external
        payable
    {
        // Realm cannot be in withdraw mode
        require(!isInWithdrawMode(), "IN_WITHDRAW_MODE");
        require(amount > 0, "INVALID_VALUE");

        // Check expected ETH value sent
        require(msg.value >= minimumWithdrawFee, "INVALID_VALUE");

        uint24 accountID = getAccountID();
        Account storage account = getAccount(accountID);

        // Allow anyone to withdraw from fee accounts
        if (!isFeeRecipientAccount(account)) {
            require(account.owner == msg.sender, "UNAUTHORIZED");
        }

        // Get the withdraw block
        WithdrawBlock storage withdrawBlock = withdrawBlocks[numWithdrawBlocks - 1];
        if (isActiveWithdrawBlockClosed()) {
            numWithdrawBlocks++;
            withdrawBlock = withdrawBlocks[numWithdrawBlocks - 1];
        }
        if (withdrawBlock.numWithdrawals == 0) {
            withdrawBlock.timestampOpened = uint32(now);
        }
        require(withdrawBlock.numWithdrawals < NUM_WITHDRAWALS_IN_BLOCK, "BLOCK_FULL");

        // Increase the fee for this block
        withdrawBlock.fee = withdrawBlock.fee.add(msg.value);

        // Update the withdraw block hash
        withdrawBlock.hash = sha256(
            abi.encodePacked(
                withdrawBlock.hash,
                accountID,
                tokenID,
                amount
            )
        );
        withdrawBlock.numWithdrawals++;
        if (withdrawBlock.numWithdrawals == NUM_WITHDRAWALS_IN_BLOCK) {
            withdrawBlock.timestampFilled = uint32(now);
        }

        emit WithdrawRequest(
            uint32(numWithdrawBlocks - 1),
            uint16(withdrawBlock.numWithdrawals - 1),
            accountID,
            tokenID,
            amount
        );
    }

    // == Internal Functions ==

    function createDefaultAccount()
        internal
    {
        // Reserve default account slot at accountID 0
        Account memory defaultAccount = Account(
            address(0),
            false,
            DEFAULT_ACCOUNT_PUBLICKEY_X,
            DEFAULT_ACCOUNT_PUBLICKEY_Y
        );
        accounts.push(defaultAccount);
    }

    function getAccount(
        uint24 accountID
        )
        internal
        view
        returns (Account storage account)
    {
        require(accountID < accounts.length, "INVALID_ACCOUNT_ID");
        account = accounts[accountID];
    }

    function isFeeRecipientAccount(
        Account storage account
        )
        internal
        view
        returns (bool)
    {
        return account.publicKeyX == 0 && account.publicKeyY == 0;
    }
}