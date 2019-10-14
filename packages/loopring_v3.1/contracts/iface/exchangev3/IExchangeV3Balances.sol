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


/// @title IExchangeV3Balances
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
contract IExchangeV3Balances
{
    // -- Events --
    // We need to make sure all events defined in ExchangeBalances.sol
    // are aggregrated here.
    event WithdrawalCompleted(
        uint24  indexed accountID,
        uint16  indexed tokenID,
        address         to,
        uint96          amount
    );

    event WithdrawalFailed(
        uint24  indexed accountID,
        uint16  indexed tokenID,
        address         to,
        uint96          amount
    );

    /// @dev Deposits ETH or ERC20 tokens to the exchange.
    ///      Is only callable by exchange modules.
    /// @param from The address that sends the funds
    /// @param tokenID The ID of the token
    /// @param amount The amount of tokens to deposit
    function deposit(
        address from,
        uint16  tokenID,
        uint    amount
        )
        external
        payable;

    /// @dev Withdraws ETH or ERC20 tokens to the exchange.
    ///      Is only callable by exchange modules.
    /// @param accountID The account ID to withdraw the tokens to
    /// @param tokenID The ID of the token
    /// @param amount The amount of tokens to deposit
    /// @param allowFailure True if the token transfer may fail, false otherwise
    /// @param gasLimit The amount of gas the token transfer/ETH transfer may use
    /// @return True if the funds were successfully withdrawn, false otherwise
    function withdraw(
        uint24  accountID,
        uint16  tokenID,
        uint    amount,
        bool    allowFailure,
        uint    gasLimit
        )
        external
        returns (bool success);

    /// @dev Allows an account owner to withdraw his funds using the balances stored
    ///      in the Merkle tree. The funds will be sent to the owner of the account.
    ///
    ///      Trading pubKey matching the offchain Merkle tree need to be provided.
    ///      The pubKey may already be reset to 0 when the exchange is shutdown.
    ///      The pubKey passed in here is used to calculate the Merkle root, which
    ///      needs to match perfectly with the offchain Merkle root. The onchain pubKey
    ///      doesn't matter at all in withdrawal mode.
    ///
    ///      Can only be used in withdrawal mode (i.e. when the operator has stopped
    ///      committing blocks and is not able to commit anymore blocks).
    ///
    ///      This will NOT modify the onchain merkle root! The merkle root stored
    ///      onchain will remain the same after the withdrawal. We store if the user
    ///      has withdrawn the balance in State.withdrawnInWithdrawMode.
    ///
    /// @param  token The address of the token to withdraw the tokens for
    /// @param  pubKeyX The first part of the public key of the account
    /// @param  pubKeyY The second part of the public key of the account
    /// @param  nonce The nonce of the account
    /// @param  balance The balance of the account for the given token
    /// @param  tradeHistoryRoot The merkle root of the trade history of the given token
    /// @param  accountMerkleProof The merkle proof (side node hashes) for the account.
    ///                      The deepest hash in the tree is the 1st element of the array.
    /// @param  balanceMerkleProof he merkle proof (side node hashes) for the balance of the
    ///                      token for the account. The deepest hash in the tree is the
    ///                      1st element of the array.
    function withdrawFromMerkleTree(
        address  token,
        uint     pubKeyX,
        uint     pubKeyY,
        uint32   nonce,
        uint96   balance,
        uint     tradeHistoryRoot,
        uint[30] calldata accountMerkleProof,
        uint[12] calldata balanceMerkleProof
        )
        external;

    /// @dev Allows anyone to withdraw funds for a specified user using the balances stored
    ///      in the Merkle tree. The funds will be sent to the owner of the acount.
    ///
    ///      Can only be used in withdrawal mode (i.e. when the operator has stopped
    ///      committing blocks and is not able to commit any more blocks).
    ///
    ///      This will NOT modify the onchain merkle root! The merkle root stored
    ///      onchain will remain the same after the withdrawal. We store if the user
    ///      has withdrawn the balance in State.withdrawnInWithdrawMode.
    ///
    /// @param  owner The owner of the account to withdraw the funds for.
    /// @param  token The address of the token to withdraw the tokens for
    /// @param  pubKeyX The first part of the public key of the account
    /// @param  pubKeyY The second part of the public key of the account
    /// @param  nonce The nonce of the account
    /// @param  balance The balance of the account for the given token
    /// @param  tradeHistoryRoot The merkle root of the trade history of the given token
    /// @param  accountMerkleProof The merkle proof (side node hashes) for the account.
    ///                      The deepest hash in the tree is the 1st element of the array.
    /// @param  balanceMerkleProof he merkle proof (side node hashes) for the balance of the
    ///                      token for the account. The deepest hash in the tree is the
    ///                      1st element of the array.
    function withdrawFromMerkleTreeFor(
        address  owner,
        address  token,
        uint     pubKeyX,
        uint     pubKeyY,
        uint32   nonce,
        uint96   balance,
        uint     tradeHistoryRoot,
        uint[30] calldata accountMerkleProof,
        uint[12] calldata balanceMerkleProof
        )
        external;

    /// @dev Verifies that the given information is stored in the Merkle tree with
    ///      the specified merkle root.
    /// @param  merkleRoot The Merkle tree root of all account data
    /// @param  accountID The ID of the account the balance is verified for
    /// @param  tokenID The ID of the token the balance is verified for
    /// @param  pubKeyX The first part of the public key of the account
    /// @param  pubKeyY The second part of the public key of the account
    /// @param  nonce The nonce of the account
    /// @param  balance The balance of the account for the given token
    /// @param  tradeHistoryRoot The merkle root of the trade history of the given token
    /// @param  accountMerkleProof The merkle proof (side node hashes) for the account.
    ///                      The deepest hash in the tree is the 1st element of the array.
    /// @param  balanceMerkleProof he merkle proof (side node hashes) for the balance of the
    ///                      token for the account. The deepest hash in the tree is the
    ///                      1st element of the array.
    /// @return True if the given information is stored in the Merkle tree, false otherwise
    function isAccountBalanceCorrect(
        uint     merkleRoot,
        uint24   accountID,
        uint16   tokenID,
        uint     pubKeyX,
        uint     pubKeyY,
        uint32   nonce,
        uint96   balance,
        uint     tradeHistoryRoot,
        uint[30] calldata accountMerkleProof,
        uint[12] calldata balanceMerkleProof
        )
        external
        pure
        returns (bool);

    /// @dev Withdraws all tokens not owned by users, e.g., candies, airdrops.
    ///      Can only be called by the exchange owner.
    ///
    /// @param tokenAddress The adderss of the token.
    /// @param recipient The address to send the token or ether.
    /// @return The amount of token withdrawn
    function withdrawTokenNotOwnedByUsers(
        address tokenAddress,
        address payable recipient
        )
        external
        returns (uint);

    /// @dev Allows exchange modules to transfer ERC-20 tokens for a user using the allowance
    ///      the user has set for the exchange.  This way the user only needs to approve a single exchange contract
    ///      for all exchange/module/agent features, which allows for a more seamless user experience.
    ///
    ///      This function can only be called by exchange modules.
    ///
    /// @param token The address of the token to transfer (ETH is and cannot be suppported).
    /// @param from The address of the account that sends the tokens.
    /// @param to The address to where 'amount' tokens are transferred.
    /// @param amount The amount of tokens transferred.
    function onchainTransferFrom(
        address token,
        address from,
        address to,
        uint    amount
        )
        external;
}
