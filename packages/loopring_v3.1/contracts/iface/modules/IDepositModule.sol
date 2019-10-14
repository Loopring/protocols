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

import "./IAbstractOnchainRequestModule.sol";
import "../IAuthorizable.sol";


/// @title IDepositModule
/// @author Brecht Devos - <brecht@loopring.org>
contract IDepositModule is IAbstractOnchainRequestModule, IAuthorizable
{
    uint public constant REQUEST_PRIORITY = 50;
    uint public constant MAX_OPEN_REQUESTS = 1024;

    event DepositRequested(
        uint    indexed depositIdx,
        uint24  indexed accountID,
        uint16  indexed tokenID,
        uint96          amount,
        uint            pubKeyX,
        uint            pubKeyY
    );

    event AddressWhitelistChanged(
        uint    indexed exchangeId,
        address         oldAddressWhitelist,
        address         newAddressWhitelist
    );

    event FeesUpdated(
        uint indexed exchangeId,
        uint         accountCreationFeeETH,
        uint         accountUpdateFeeETH,
        uint         depositFeeETH
    );

    // The onchain fees
    uint public accountCreationFeeETH;
    uint public accountUpdateFeeETH;
    uint public depositFeeETH;

    // The address whitelist
    address public addressWhitelist;


    /// @dev Submits an onchain request to create a new account for msg.sender or
    ///      update its existing account by replacing its trading public key.
    ///      The total fee in ETH that the user needs to pay is:
    ///          depositFee +
    ///          (isAccountNew ? accountCreationFee : 0) +
    ///          (isAccountUpdated ? accountUpdateFee : 0)
    ///      If the user sends too much ETH the surplus is sent back immediately.
    ///
    ///      Note that after such an operation, it will take the operator some
    ///      time (no more than MAX_AGE_REQUEST_UNTIL_FORCED) to process the request
    ///      and create or update the offchain account.
    ///
    ///      Calling this method with a different trading public key will effectively
    ///      cancel all existing orders within MAX_AGE_REQUEST_UNTIL_FORCED.
    ///
    /// @param  owner   The owner of the account
    /// @param  pubKeyX The first part of the account's trading EdDSA public key
    /// @param  pubKeyY The second part of the account's trading EdDSA public key.
    ///                 Note that pubkeyX and pubKeyY cannot be both `1`.
    /// @param  permission Data used for checking address whitelisting prior to
    ///                    account creation.
    /// @return accountID The account's ID
    /// @return isAccountNew True if this account is newly created, false if the account existed
    /// @return isAccountUpdated True if this account was updated, false otherwise
    function createOrUpdateAccount(
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
        );

    /// @dev Deposits Ether or ERC20 tokens to the sender's account.
    ///      This function will create a new account if no account exists
    ///      for msg.sender, or update the existing account with the given trading
    ///      public key when the account exists.
    ///
    ///      The total fee in ETH that the user needs to pay is:
    ///          depositFee +
    ///          (isAccountNew ? accountCreationFee : 0) +
    ///          (isAccountUpdated ? accountUpdateFee : 0)
    ///      If the user sends too much ETH the surplus is sent back immediately.
    ///
    ///      Note that after such an operation, it will take the operator some
    ///      time (no more than MAX_AGE_REQUEST_UNTIL_FORCED) to process the request
    ///      and create the deposit to the offchain account.
    ///
    ///      Calling this method with a different trading public key will effectively
    ///      cancel all existing orders within MAX_AGE_REQUEST_UNTIL_FORCED.
    ///
    /// @param  owner   The owner of the account
    /// @param  pubKeyX The first part of the account's trading EdDSA public key
    /// @param  pubKeyY The second part of the account's trading EdDSA public key
    /// @param  tokenAddress The address of the token, use `0x0` for Ether.
    /// @param  amount The amount of tokens to deposit
    /// @param  permission Data used for checking address whitelisting prior to
    ///                    account creation.
    /// @return accountID The id of the account
    /// @return isAccountNew True if this account is newly created, false if the account existed
    /// @return isAccountUpdated True if this account was updated, false otherwise
    function updateAccountAndDeposit(
        address owner,
        uint    pubKeyX,
        uint    pubKeyY,
        address tokenAddress,
        uint96  amount,
        bytes   calldata permission
        )
        external
        payable
        returns (
            uint24 accountID,
            bool   isAccountNew,
            bool   isAccountUpdated
        );

    /// @dev Deposits Ether or ERC20 tokens to a recipient account.
    ///
    ///      The total fee in ETH that the user needs to pay is 'depositFee'.
    ///      If the user sends too much ETH the surplus is sent back immediately.
    ///
    ///      Note that after such an operation, it will take the operator some
    ///      time (no more than MAX_AGE_REQUEST_UNTIL_FORCED) to process the request
    ///      and create the deposit to the offchain account.
    ///
    /// @param from The address sending the tokens
    /// @param to The address of the recipient
    /// @param tokenAddress The adderss of the token, use `0x0` for Ether.
    /// @param amount The amount of tokens to deposit
    function deposit(
        address from,
        address to,
        address tokenAddress,
        uint96  amount
        )
        external
        payable;

    /// @dev Allows withdrawing funds deposited to the contract in a deposit request when
    ///      it was never committed in a block (so the balance in the Merkle tree was
    ///      not updated).
    ///
    ///      Can be called by anyone. The deposited tokens will be sent back to
    ///      the owner of the account they were deposited in.
    ///
    ///      Can only be used in withdrawal mode (i.e. when the operator has stopped
    ///      committing blocks and is not able to commit anymore blocks).
    ///
    /// @param  depositIdx The index of the deposit request (as given in the
    ///                    depositIdx field in the DepositRequested event)
    function withdrawFromDepositRequest(
        uint depositIdx
        )
        external;

    /// @dev Updates fee settings.
    ///      This function is only callable by the exchange owner.
    /// @param _accountCreationFeeETH The fee in ETH for account creation
    /// @param _accountUpdateFeeETH The fee in ETH for account update
    /// @param _depositFeeETH The fee in ETH for deposits
    function setFees(
        uint _accountCreationFeeETH,
        uint _accountUpdateFeeETH,
        uint _depositFeeETH
        )
        external;

    /// @dev Sets the address whitelist contract address.
    ///      Can only be called by the exchange owner.
    /// @param _addressWhitelist The new address whitelist contract address
    /// @return oldAddressWhitelist The old address whitelist contract address
    function setAddressWhitelist(
        address _addressWhitelist
        )
        external
        returns (address oldAddressWhitelist);
}
