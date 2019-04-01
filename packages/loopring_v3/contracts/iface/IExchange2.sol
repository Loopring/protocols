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

/// @title An Implementation of IExchange.
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
contract IExchange2
{
    // -- Events --
    // We need to make sure all events defined in exchange/*.sol
    // are aggregrated here.
    event AccountCreated(
        address owner,
        uint24  id,
        uint    pubKeyX,
        uint    pubKeyY
    );

    event AccountUpdated(
        address owner,
        uint24  id,
        uint    pubKeyX,
        uint    pubKeyY
    );

    event TokenRegistered(
        address token,
        uint16 tokenId
    );

    event OperatorChanged(
        uint exchangeId,
        address oldOperator,
        address newOperator
    );

    event FeesUpdated(
        uint accountCreationFeeETH,
        uint accountUpdateFeeETH,
        uint depositFeeETH,
        uint withdrawalFeeETH
    );

    event BlockCommitted(
        uint blockIdx,
        bytes32 publicDataHash
    );

    event BlockFinalized(
        uint blockIdx
    );

    event Revert(
        uint blockIdx
    );

    event DepositRequested(
        uint32 depositIdx,
        uint24 accountID,
        uint16 tokenID,
        uint96 amount
    );

    event BlockFeeWithdraw(
        uint32 blockIdx,
        uint amount
    );

    event WithdrawalRequested(
        uint32 withdrawalIdx,
        uint24 accountID,
        uint16 tokenID,
        uint96 amount
    );

    event WithdrawalCompleted(
        uint24  accountID,
        uint16  tokenID,
        address to,
        uint96  amount
    );

    // -- Settings --
    function getGlobalSettings()
        public
        pure
        returns (
            uint   DEFAULT_ACCOUNT_PUBLICKEY_X,
            uint   DEFAULT_ACCOUNT_PUBLICKEY_Y,
            uint   DEFAULT_ACCOUNT_SECRETKEY,
            uint32 MAX_PROOF_GENERATION_TIME_IN_SECONDS,
            uint16 MAX_OPEN_REQUESTS,
            uint32 MAX_AGE_REQUEST_UNTIL_FORCED,
            uint32 MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE,
            uint32 TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS,
            uint   MAX_NUM_TOKENS
        );

    // -- Mode --
    function isInWithdrawalMode()
        external
        view
        returns(bool);

    // -- Accounts --

    /// @dev Get the account information for a given address.
    /// @param  owner The owning address of the account
    /// @return accountID The account's ID
    /// @return pubKeyX The first part of the account's trading EdDSA public key
    /// @return pubKeyY The second part of the account's trading EdDSA public key
    function getAccount(
        address owner
        )
        external
        view
        returns (
            uint24 accountID,
            uint   pubKeyX,
            uint   pubKeyY
        );

    /// @dev Submit an onchain request to create a new account for msg.sender or
    ///      update its existing account by replacing its trading public key.
    /// @param  pubKeyX The first part of the account's trading EdDSA public key
    /// @param  pubKeyY The second part of the account's trading EdDSA public key
    /// @return accountID The account's ID
    /// @return isAccountNew True if this account is newly created, false if the account existed
    function createOrUpdateAccount(
        uint pubKeyX,
        uint pubKeyY
        )
        external
        payable
        returns (
            uint24 accountID,
            bool   isAccountNew
        );

    // -- Balances --
    // TODO(brecht): document this method
    function isAccountBalanceCorrect(
        uint256 merkleRoot,
        uint24  accountID,
        uint16  tokenID,
        uint256 pubKeyX,
        uint256 pubKeyY,
        uint32  nonce,
        uint96  balance,
        uint256 tradeHistoryRoot,
        uint256[24] calldata accountPath,
        uint256[12] calldata balancePath
        )
        external
        returns (bool);

    // -- Tokens --

    /// @dev Register an ERC20 token for a token id. Note that different exchanges may have
    ///      different ids for the same ERC20 token.
    ///
    ///      Please note that 1 is reserved for Ether (ETH), 2 is reserved for Wrapped Ether (ETH),
    ///      and 3 is reserved for Loopring Token (LRC).
    ///
    ///      This function is only callable by the exchange owner.
    ///
    /// @param  tokenAddress The token's address
    /// @return tokenID The token's ID in this exchanges.
    /// @return isAccountNew True if this account is newly created, false if the account existed
    function registerToken(
        address tokenAddress
        )
        external
        payable
        returns (uint16 tokenID);

    /// @dev Returns the id of a registered token.
    /// @param  tokenAddress The token's address
    /// @return tokenID The token's ID in this exchanges.
    function getTokenID(
        address tokenAddress
        )
        external
        view
        returns (uint16 tokenID);

    /// @dev Returns the address of a registered token.
    /// @param  tokenID The token's ID in this exchanges.
    /// @return tokenAddress The token's address
    function getTokenAddress(
        uint16 tokenID
        )
        external
        view
        returns (address tokenAddress);

    /// @dev Disable users to submit onchain deposit requests for a token.
    ///      This function is only callable by the exchange owner.
    /// @param  tokenAddress The token's address
    function disableTokenDeposit(
        address tokenAddress
        )
        external
        payable;

    /// @dev Enable users to submit onchain deposit requests for a token.
    ///      This function is only callable by the exchange owner.
    /// @param  tokenAddress The token's address
    function enableTokenDeposit(
        address tokenAddress
        )
        external
        payable;

    // -- Stakes --
    /// @dev Get the amount of LRC the owner has staked onchain for this exchange.
    ///      The stake will be burned if the exchange does not fulfill its duty by
    ///      processing user requests in time. Please note that order matching may potentially
    ///      performaed by another party and is not part of the exchagne's duty.
    ///
    /// @return The amount of LRC staked
    function getStake()
        external
        view
        returns (uint);

    // -- Blocks --
    /// @dev Get the height of this exchange's virtual blockchain. The block height for a
    ///      new exchange is 0.
    /// @return The virtual blockchain height which is the index of the last block.
    function getBlockHeight()
        external
        view
        returns (uint);

    /// @dev Commit a new block to the virtual blockchain without the proof.
    ///      This function is only callable by the exchange operator.
    ///
    /// @param blockType The type of the new block
    /// @param numElements The number of onchain or offchain requests/settlements
    ///        that have been processed in this block
    /// @param data The data for this block
    function commitBlock(
        uint8 blockType,
        uint16 numElements,
        bytes calldata data
        )
        external
        payable;

    /// @dev Submit a ZK proof onchain to verify a previouly committed block. Submitting an
    ///      invalid proof will not change the state of the exchange. Note that proofs can
    ///      be submitted in a different order than the blocks themselves.
    ///
    ///      This method can be called by anyone with a valid proof.
    ///
    /// @param blockIdx The 0-based index of the block to be verified with the given proof
    /// @param proof The ZK proof
    function verifyBlock(
        uint blockIdx,
        uint256[8] calldata proof
        )
        external
        payable;

    /// @dev Revert the exchange's virtual blockchain until a specific block index.
    ///      After MAX_PROOF_GENERATION_TIME_IN_SECONDS seconds (the timeout), if a valid
    ///      proof is still not submitted onchain, anyone can call this method to trigger
    ///      the blockchain to revert.
    ///
    ///      If more than one blocks (A, B) are missing proofs after the required timeout,
    ///      one can only trigger the blockchain to revert until A.
    ///
    ///      This method can be called by anyone.
    ///
    /// @param blockIdx The 0-based index of the block that does not have a valid proof within
    ///        MAX_PROOF_GENERATION_TIME_IN_SECONDS seconds.
    function revertBlock(
        uint32 blockIdx
        )
        external
        payable;

    // -- Deposits --
    /// TODO(brecht): document this
    function getFirstUnprocessedDepositRequestIndex()
        external
        view
        returns (uint);

    /// @dev Get the number of available onchain deposit slots.
    /// @return The number of slots
    function getNumAvailableDepositSlots()
        external
        view
        returns (uint);

    /// @dev Get an item from deposit request-chain.
    /// @param index The 0-based index of the request
    /// @return accumulatedHash See @Request
    /// @return accumulatedFee  See @Request
    /// @return timestamp       See @Request
    function getDepositRequest(
        uint index
        )
        external
        view
        returns (
          bytes32 accumulatedHash,
          uint256 accumulatedFee,
          uint32  timestamp
        );

    /// @dev Deposit Ether or ERC20 tokens to the sender's account.
    ///      This function will create a new account if such no account exists
    ///      for msg.sender, or update the existing account with the given trading
    ///      public key when the account exists.
    ///
    ///      Note that after such an operation, it will take the operator some
    ///      time (no more than MAX_AGE_REQUEST_UNTIL_FORCED) to process the request
    ///      and create the deposit to the offchain account.
    ///
    /// @param  pubKeyX The first part of the account's trading EdDSA public key
    /// @param  pubKeyY The second part of the account's trading EdDSA public key
    /// @param  tokenAddress The adderss of the token, use `0x0` for Ether.
    /// @param  amount The amount of tokens to deposit
    /// @return accountID The id of the account
    /// @return isAccountNew True if this account is newly created, false if the account existed
    function updateAccountAndDeposit(
        uint    pubKeyX,
        uint    pubKeyY,
        address tokenAddress,
        uint96  amount
        )
        external
        payable
        returns (
            uint24 accountID,
            bool   isAccountNew
        );

    /// @dev Deposit Ether or ERC20 tokens to the sender's account.
    ///
    ///      Note that after such an operation, it will take the operator some
    ///      time (no more than MAX_AGE_REQUEST_UNTIL_FORCED) to process the request
    ///      and create the deposit to the offchain account.
    ///
    /// @param tokenAddress The adderss of the token, use `0x0` for Ether.
    /// @param amount The amount of tokens to deposit
    function deposit(
        address tokenAddress,
        uint96  amount
        )
        external
        payable;

    /// @dev Deposit Ether or ERC20 tokens to a recipient account.
    ///
    ///      Note that after such an operation, it will take the operator some
    ///      time (no more than MAX_AGE_REQUEST_UNTIL_FORCED) to process the request
    ///      and create the deposit to the offchain account.
    ///
    /// @param recipient The address of the recipient
    /// @param tokenAddress The adderss of the token, use `0x0` for Ether.
    /// @param amount The amount of tokens to deposit
    function depositTo(
        address recipient,
        address tokenAddress,
        uint96  amount
        )
        external
        payable;

    // -- Withdrawals --
    /// TODO(brecht): document this
    function getFirstUnprocessedWithdrawalRequestIndex()
        external
        view
        returns (uint);

    /// @dev Get the number of available onchain withdrawal slots.
    /// @return The number of slots
    function getNumAvailableWithdrawalSlots(
        )
        external
        view
        returns (uint);

    /// @dev Get an item from withdrawal request-chain.
    /// @param index The 0-based index of the request
    /// @return accumulatedHash See @Request
    /// @return accumulatedFee  See @Request
    /// @return timestamp       See @Request
    function getWithdrawRequest(
        uint index
        )
        external
        view
        returns (
            bytes32 accumulatedHash,
            uint256 accumulatedFee,
            uint32 timestamp
        );

    // Set the large value for amount to withdraw the complete balance
    /// @dev Submit an onchain request to withdraw Ether or ERC20 tokens. To withdraw
    ///      all the balance, use a very large number for `amount`.
    ///
    ///      Note that after such an operation, it will take the operator some
    ///      time (no more than MAX_AGE_REQUEST_UNTIL_FORCED) to process the request
    ///      and create the deposit to the offchain account.
    ///
    /// @param tokenAddress The adderss of the token, use `0x0` for Ether.
    /// @param amount The amount of tokens to deposit
    function withdraw(
        address tokenAddress,
        uint96 amount
        )
        external
        payable;

    /// TODO(Brecht): document this function. Need more info regarding when this method will be used.
    function withdrawFromMerkleTree(
        address token,
        uint32  nonce,
        uint96  balance,
        uint256 tradeHistoryRoot,
        uint256[24] calldata accountPath,
        uint256[12] calldata balancePath
        )
        external
        payable;

    // We still alow anyone to withdraw these funds for the account owner
    /// TODO(Brecht): document this function. Need more info regarding when this method will be used.
    function withdrawFromMerkleTreeFor(
        address owner,
        address token,
        uint32  nonce,
        uint96  balance,
        uint256 tradeHistoryRoot,
        uint256[24] calldata accountPath,
        uint256[12] calldata balancePath
        )
        external
        payable;

    /// TODO(Brecht): document this function. Need more info regarding when this method will be used.
    function withdrawFromDepositRequest(
        uint depositRequestIdx
        )
        external
        payable;

    /// TODO(Brecht): document this function. Need more info regarding when this method will be used.
    function withdrawFromApprovedWithdrawal(
        uint blockIdx,
        uint slotIdx
        )
        external
        payable;

    /// TODO(Brecht): document this function. Need more info regarding when this method will be used.
    function withdrawBlockFee(
        uint32 blockIdx
        )
        external
        payable
        returns (uint feeAmount);

    /// TODO(Brecht): document this function. Need more info regarding when this method will be used.
    function distributeWithdrawals(
        uint blockIdx
        )
        external
        payable;

    // -- Admins --

    /// @dev Set the operator address.
    /// @param _operator The new operator's address
    /// @return oldOperator The old operator's address
    function setOperator(
        address payable _operator
        )
        external
        returns (address payable oldOperator);

    /// @dev Update fee settings.
    ///      This function is only callable by the exchange owner.
    /// @param _accountCreationFeeETH The fee in ETH for account creation
    /// @param _accountUpdateFeeETH The fee in ETH for account update
    /// @param _depositFeeETH The fee in ETH for deposits
    /// @param _withdrawalFeeETH The fee in ETH for onchain withdrawal requests
    function setFees(
        uint _accountCreationFeeETH,
        uint _accountUpdateFeeETH,
        uint _depositFeeETH,
        uint _withdrawalFeeETH
        )
        external;

    /// @dev Get current fee settings.
    /// @return _accountCreationFeeETH The fee in ETH for account creation
    /// @return _accountUpdateFeeETH The fee in ETH for account update
    /// @return _depositFeeETH The fee in ETH for deposits
    /// @return _withdrawalFeeETH The fee in ETH for onchain withdrawal requests
    function getFees()
        external
        view
        returns (
            uint _accountCreationFeeETH,
            uint _accountUpdateFeeETH,
            uint _depositFeeETH,
            uint _withdrawalFeeETH
        );

    /// @dev Purchase downtime by burning LRC and enter the maintaince mode.
    ///      In the maintainance mode,  all onchain user requests, including account creation,
    ///      account update, deposits, and withdrawal requests are disabled.
    ///
    ///      If the remaining downtime is non-zero, calling this function will extend the
    ///      remaining downtime by `durationSeconds`.
    ///
    ///      The only way to get out of the maintaince mode is waiting for the
    ///      remaining downtime to reduce to 0. Therefore, exchange owner should be very
    ///      cautious not to purchae too much downtime.
    ///
    ///      Once entering the maintainance mode, the operator should still fulfill his duty
    ///      by submitting blocks and proofs until all pending user requests have been taken
    ///      care of within the required timeouts. Then the operator can stop his servers and go
    ///      completly offline.
    ///
    ///      TODO(brecht): after all pending onchain requests have been handled, can the operator
    ///                    stop submitting any blocks (even empty blocks)? Ideally, the operator
    ///                    should be able to stop all servers and go completely offchain.
    ///
    ///      This function is only callable by the exchange owner.
    ///
    /// @param durationSeconds The duration in seconds that this exchange will remain in
    ///                        the maintaince mode.
    function purchaseDowntime(
        uint durationSeconds
        )
        external
        payable;

    /// @dev Get the remaining downtime.
    /// @return durationSeconds Remaining downtime in second.
    function getRemainingDowntime()
        external
        view
        returns (uint durationSeconds);

    /// @dev Get the amount of LRC to burn for buying the downtime.
    /// @return costLRC The amount of LRC to burn
    function getDowntimeCostLRC(
        uint durationSeconds
        )
        external
        view
        returns (uint costLRC);
}