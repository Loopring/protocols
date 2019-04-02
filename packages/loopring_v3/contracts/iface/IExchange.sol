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
contract IExchange
{
    // -- Events --
    // We need to make sure all events defined in exchange/*.sol
    // are aggregrated here.
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

    event TokenRegistered(
        address indexed token,
        uint16  indexed tokenId
    );

    event OperatorChanged(
        uint    indexed exchangeId,
        address         oldOperator,
        address         newOperator
    );

    event FeesUpdated(
        uint    indexed exchangeId,
        uint            accountCreationFeeETH,
        uint            accountUpdateFeeETH,
        uint            depositFeeETH,
        uint            withdrawalFeeETH
    );

    event BlockCommitted(
        uint    indexed blockIdx,
        bytes32 indexed publicDataHash
    );

    event BlockFinalized(
        uint    indexed blockIdx
    );

    event Revert(
        uint    indexed blockIdx
    );

    event DepositRequested(
        uint32  indexed depositIdx,
        uint24  indexed accountID,
        uint16  indexed tokenID,
        uint96          amount
    );

    event BlockFeeWithdrawn(
        uint32  indexed blockIdx,
        uint            amount
    );

    event WithdrawalRequested(
        uint32  indexed withdrawalIdx,
        uint24  indexed accountID,
        uint16  indexed tokenID,
        uint96          amount
    );

    event WithdrawalCompleted(
        uint24  indexed accountID,
        uint16  indexed tokenID,
        address         to,
        uint96          amount
    );

    // -- Settings --
    function getGlobalSettings()
        public
        pure
        returns (
            uint   TOKEN_REGISTRATION_FEE_IN_LRC_BASE,
            uint   TOKEN_REGISTRATION_FEE_IN_LRC_DELTA,
            uint32 MAX_PROOF_GENERATION_TIME_IN_SECONDS,
            uint16 MAX_OPEN_DEPOSIT_REQUESTS,
            uint16 MAX_OPEN_WITHDRAWAL_REQUESTS,
            uint32 MAX_AGE_UNFINALIZED_BLOCK_UNTIL_WITHDRAW_MODE,
            uint32 MAX_AGE_REQUEST_UNTIL_FORCED,
            uint32 MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE,
            uint32 TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS,
            uint32 FEE_BLOCK_FINE_START_TIME,
            uint32 FEE_BLOCK_FINE_MAX_DURATION,
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
    /// @dev Verifies that the given information is stored in the merkle tree with
    ///      the specified merkle root.
    /// @param  merkleRoot The merkle tree root of all account data
    /// @param  accountID The ID of the account the balance is verified for
    /// @param  tokenID The ID of the token the balance is verified for
    /// @param  pubKeyX The first part of the public key of the account
    /// @param  pubKeyY The second part of the public key of the account
    /// @param  nonce The nonce of the account
    /// @param  balance The balance of the account for the given token
    /// @param  tradeHistoryRoot The merkle root of the trade history of the given token
    /// @param  accountPath The merkle proof for the account
    /// @param  accountPath The merkle proof for the balance of the token for the account
    /// @return True if the given information is stored in the merkle tree, false otherwise
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
        pure
        returns (bool);

    // -- Tokens --

    /// @dev Get the required amount of LRC to burn for registering one more token.
    /// @return feeLRC The amount of LRC to burn.
    function getLRCFeeForRegisteringOneMoreToken()
        external
        view
        returns (uint feeLRC);

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
        external;

    /// @dev Enable users to submit onchain deposit requests for a token.
    ///      This function is only callable by the exchange owner.
    /// @param  tokenAddress The token's address
    function enableTokenDeposit(
        address tokenAddress
        )
        external;

    // -- Stakes --
    /// @dev Get the amount of LRC the owner has staked onchain for this exchange.
    ///      The stake will be burned if the exchange does not fulfill its duty by
    ///      processing user requests in time. Please note that order matching may potentially
    ///      performed by another party and is not part of the exchange's duty.
    ///
    /// @return The amount of LRC staked
    function getStake()
        external
        view
        returns (uint);

    /// @dev Can by called by anyone to burn the stake of the exchange when certain
    ///      conditions are fulfilled.
    ///
    ///      Currently this will only burn the stake of the exchange if there are
    ///      unfinalized blocks and the exchange is in withdrawal mode.
    function burnStake()
        external;

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
    /// @param data The data for this block -
    ///        For all block types:
    ///            - Exchange ID: 4 bytes
    ///            - Old merkle root: 32 bytes
    ///            - New merkle root: 32 bytes
    ///        For SETTLEMENT blocks add the following data:
    ///            - timestamp used in the block: 4 bytes
    ///        For DEPOSIT blocks add the following data:
    ///            - Starting hash: 32 bytes
    ///            - Ending hash: 32 bytes
    ///            - Start index (in deposit chain): 4 bytes
    ///            - Number of deposits processed: 4 bytes
    ///        For ONCHAIN_WITHDRAW blocks add the following data:
    ///            - Starting hash: 32 bytes
    ///            - Ending hash: 32 bytes
    ///            - Start index (in withdrawal chain): 4 bytes
    ///            - Number of withdrawals processed: 4 bytes
    ///            - For every withdrawal:
    ///                - Account ID: 3 bytes
    ///                - Token ID: 2 bytes
    ///                - Amount: 12 bytes
    ///        For OFFCHAIN_WITHDRAW blocks add the following data:
    ///            - None
    ///        For CANCEL blocks add the following data:
    ///            - None
    ///
    ///        The 'onchain data availability' data (if enabled) is added
    ///        at the end. This allows anyone to recreate the merkle tree
    ///        just by using data published on the Ethereum blockchain.
    ///
    ///        For SETTLEMENT blocks add the following data:
    ///            - Operator account ID: 3 bytes
    ///            - For every ring
    ///                - Ring-matcher account ID: 3 bytes
    ///                - Fee-recipient account ID: 3 bytes
    ///                - Token ID (fee to operator): 2 bytes
    ///                - Fee amount: 12 bytes
    ///                - Margin (paid by first order): 12 bytes
    ///                - For both Orders:
    ///                    - Account ID: 3 bytes
    ///                    - Wallet account ID: 3 bytes
    ///                    - TokenS: 2 bytes
    ///                    - TokenF: 2 bytes
    ///                    - Order ID: 4 bytes
    ///                    - FillS: 12 bytes
    ///                    - FillF: 12 bytes
    ///                    - WalletSplitPercentage: 1 byte
    ///                    - WaiveFeePercentage: 1 byte
    ///        For DEPOSIT blocks add the following data:
    ///            - None
    ///        For ONCHAIN_WITHDRAW blocks add the following data:
    ///            - None
    ///        For OFFCHAIN_WITHDRAWAL blocks add the following data:
    ///            - Operator account ID: 3 bytes
    ///            - For every withdrawal:
    ///                - Wallet account ID: 3 bytes
    ///                - Fee token ID: 2 bytes
    ///                - Fee amount: 12 bytes
    ///                - WalletSplitPercentage: 1 byte
    ///        For CANCEL blocks add the following data:
    ///            - Operator account ID: 3 bytes
    ///            - For every cancel:
    ///                - Account ID: 3 bytes
    ///                - Token ID: 2 bytes
    ///                - Order ID: 4 bytes
    ///                - Wallet Account ID: 3 bytes
    ///                - Fee token ID: 2 bytes
    ///                - Fee amount: 12 bytes
    ///                - WalletSplitPercentage: 1 byte
    function commitBlock(
        uint8 blockType,
        uint16 numElements,
        bytes calldata data
        )
        external;

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
        external;

    /// @dev Revert the exchange's virtual blockchain until a specific block index.
    ///      After MAX_PROOF_GENERATION_TIME_IN_SECONDS seconds (the timeout), if a valid
    ///      proof is still not submitted onchain, the operator can call this method to trigger
    ///      the blockchain to revert.
    ///
    ///      If more than one blocks (A, B) are missing proofs after the required timeout,
    ///      one can only trigger the blockchain to revert until A.
    ///
    ///      This method can only be called by the operator when not in withdrawal mode.
    ///
    ///      In withdrawal mode anyone can call burnStake so the exchange still gets punished
    ///      for committing blocks it does not prove.
    ///
    /// @param blockIdx The 0-based index of the block that does not have a valid proof within
    ///        MAX_PROOF_GENERATION_TIME_IN_SECONDS seconds.
    function revertBlock(
        uint32 blockIdx
        )
        external;

    // -- Deposits --
    /// @dev Returns the index of the first deposit request that wasn't yet included
    ///      in a block. Can be used to check if a deposit with a given depositIdx
    ///      (as specified in the DepositRequested event) was processed by the operator.
    /// @return The num of the processed deposit requests
    function getNumDepositRequestsProcessed()
        external
        view
        returns (uint);

    /// @dev Get the number of available onchain deposit slots.
    /// @return The number of slots avalable for deposits.
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
    /// @dev Returns the index of the first withdrawal request that wasn't yet included
    ///      in a block. Can be used to check if a withdrawal with a given withdrawalIdx
    ///      (as specified in the WithdrawalRequested event) was processed by the operator.
    /// @return The num of processed withdrawal requests
    function getNumWithdrawalRequestsProcessed()
        external
        view
        returns (uint);

    /// @dev Get the number of available onchain withdrawal slots.
    /// @return The number of slots available for withdrawals
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

    /// @dev Allows an account owner to withdraw his funds using the balances stored
    ///      in the merkle tree. The funds will be sent to the owner of the acount.
    ///
    ///      Can only be used in withdrawal mode (i.e. when the operator has stopped
    ///      committing blocks and is not able to commit anymore blocks).
    ///
    ///      This will NOT modify the onchain merkle root! The merkle root stored
    ///      onchain will remain the same after the withdrawal. We store if the user
    ///      has withdrawn the balance in State.withdrawnInWithdrawMode.
    ///
    /// @param  token The address of the token to withdraw the tokens for
    /// @param  nonce The nonce of the account
    /// @param  balance The balance of the account for the given token
    /// @param  tradeHistoryRoot The merkle root of the trade history of the given token
    /// @param  accountPath The merkle proof for the account
    /// @param  accountPath The merkle proof for the balance of the token
    function withdrawFromMerkleTree(
        address token,
        uint32  nonce,
        uint96  balance,
        uint256 tradeHistoryRoot,
        uint256[24] calldata accountPath,
        uint256[12] calldata balancePath
        )
        external;

    /// @dev Allows anyone to withdraw funds for a specified user using the balances stored
    ///      in the merkle tree. The funds will be sent to the owner of the acount.
    ///
    ///      Can only be used in withdrawal mode (i.e. when the operator has stopped
    ///      committing blocks and is not able to commit anymore blocks).
    ///
    ///      This will NOT modify the onchain merkle root! The merkle root stored
    ///      onchain will remain the same after the withdrawal. We store if the user
    ///      has withdrawn the balance in State.withdrawnInWithdrawMode.
    ///
    /// @param  owner The owner of the account to withdraw the funds for.
    /// @param  token The address of the token to withdraw the tokens for
    /// @param  nonce The nonce of the account
    /// @param  balance The balance of the account for the given token
    /// @param  tradeHistoryRoot The merkle root of the trade history of the given token
    /// @param  accountPath The merkle proof for the account
    /// @param  accountPath The merkle proof for the balance of the token
    function withdrawFromMerkleTreeFor(
        address owner,
        address token,
        uint32  nonce,
        uint96  balance,
        uint256 tradeHistoryRoot,
        uint256[24] calldata accountPath,
        uint256[12] calldata balancePath
        )
        external;

    /// @dev Allows withdrawing funds deposited to the contract in a deposit request when
    ///      it was never committed in a block (so the balance in the merkle tree was
    ///      not updated).
    ///
    ///      Can be called by anyone. The deposited tokens will be sent back to
    ///      the owner of the account they were deposited in.
    ///
    ///      Can only be used in withdrawal mode (i.e. when the operator has stopped
    ///      committing blocks and is not able to commit anymore blocks).
    ///
    /// @param  depositRequestIdx The index of the deposit request (as given in the
    ///                           depositIdx field in the DepositRequested event)
    function withdrawFromDepositRequest(
        uint depositRequestIdx
        )
        external;

    /// @dev Allows withdrawing funds after a withdrawal request (either onchain
    ///      or offchain) was committed in a block by the operator.
    ///
    ///      Can be called by anyone. The withdrawan tokens will be sent to
    ///      the owner of the account they were withdrawn out.
    ///
    ///      Normally it is should not be needed for users to call this manually.
    ///      Funds from withdrawal requests will be sent to the account owner
    ///      by the operator in distributeWithdrawals. The user can however
    ///      choose to withdraw earlier if he wants, or will need to call this
    ///      manually if nobody calls distributeWithdrawals.
    ///
    ///      Funds can only be withdrawn from requests processed in a
    ///      finalized block (i.e. a block that can never be reverted).
    ///
    /// @param  blockIdx The block the withdrawal requests was committed in
    /// @param  slotIdx The index in the list of withdrawals that were processed
    ///                 by the operator. It is not possible for users to know
    ///                 what this index will be for their withdrawal request.
    function withdrawFromApprovedWithdrawal(
        uint blockIdx,
        uint slotIdx
        )
        external;

    /// @dev Allows the operator to withdraw the fees he earned by processing the
    ///      deposit and onchain withdrawal requests.
    ///
    ///      Can be called by anyone. The funds will be sent to the operator.
    ///
    ///      The block fee can only be withdrawn from finalized blocks
    ///      (i.e. blocks that can never be reverted).
    ///
    /// @param  blockIdx The block index to withdraw the funds for
    /// @return feeAmount The amount of ETH earned in the block and sent to the operator
    function withdrawBlockFee(
        uint32 blockIdx
        )
        external
        returns (uint feeAmount);

    /// @dev Distributes the the funds to the account owners after their withdrawal
    ///      requests were processed by the operator.
    ///
    ///      Needs to be called by the operator after submitting a block processing
    ///      withdrawal requests (either onchain or offchain requests) after the block
    ///      is finalized and before the block is MAX_TIME_TO_DISTRIBUTE_WITHDRAWALS seconds old.
    ///
    ///      If the operator fails to do so anyone will be able to call this function
    ///      and the stake of the exchange will be used to reward the caller of this function.
    ///      The amount of staked LRC withdrawn is calculated as follows:
    ///
    ///      totalFine = withdrawalFineLRC * numWithdrawalRequestsInBlock
    ///      The caller of the function will be rewarded half this amount,
    ///      the other half is burned.
    ///
    ///      Only withdrawals processed in finalized blocks can be distributed.
    ///
    /// @param  blockIdx The block index to distribute the funds from the withdrawal requests for
    function distributeWithdrawals(
        uint blockIdx
        )
        external;

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
    ///      care of within the required timeouts. In the maintaince mode, operator can no longer
    ///      submit settlement blocks.
    ///
    ///      After all pending onchain requests have been handled, the operator can no longer
    ///      submit blocks of any type until the downtime times out.
    ///
    ///      This function is only callable by the exchange owner.
    ///
    /// @param durationSeconds The duration in seconds that this exchange will remain in
    ///                        the maintaince mode.
    function purchaseDowntime(
        uint durationSeconds
        )
        external;

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

    /// @dev Get number of available/processed deposits/withdrawals.
    /// @return numDepositRequestsProcessed The num of the processed deposit requests
    /// @return numAvailableDepositSlots The number of slots avalable for deposits
    /// @return numWithdrawalRequestsProcessed The num of processed withdrawal requests
    /// @return numAvailableWithdrawalSlots The number of slots avalable for withdrawals
    function getRequestStats()
        external
        view
        returns(
            uint numDepositRequestsProcessed,
            uint numAvailableDepositSlots,
            uint numWithdrawalRequestsProcessed,
            uint numAvailableWithdrawalSlots
        );
}