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

    event Shutdown(
        uint            timestamp
    );

    event BlockCommitted(
        uint    indexed blockIdx,
        bytes32 indexed publicDataHash
    );

    event BlockVerified(
        uint    indexed blockIdx
    );

    event BlockFinalized(
        uint    indexed blockIdx
    );

    event Revert(
        uint    indexed blockIdx
    );

    event DepositRequested(
        uint    indexed depositIdx,
        uint24  indexed accountID,
        uint16  indexed tokenID,
        uint96          amount,
        uint            pubKeyX,
        uint            pubKeyY
    );

    event BlockFeeWithdrawn(
        uint    indexed blockIdx,
        uint            amount
    );

    event WithdrawalRequested(
        uint    indexed withdrawalIdx,
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
            uint32 MAX_PROOF_GENERATION_TIME_IN_SECONDS,
            uint16 MAX_OPEN_DEPOSIT_REQUESTS,
            uint16 MAX_OPEN_WITHDRAWAL_REQUESTS,
            uint32 MAX_AGE_UNFINALIZED_BLOCK_UNTIL_WITHDRAW_MODE,
            uint32 MAX_AGE_REQUEST_UNTIL_FORCED,
            uint32 MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE,
            uint32 MAX_TIME_TO_DISTRIBUTE_WITHDRAWALS,
            uint32 MAX_TIME_IN_SHUTDOWN_BASE,
            uint32 MAX_TIME_IN_SHUTDOWN_DELTA,
            uint32 TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS,
            uint32 FEE_BLOCK_FINE_START_TIME,
            uint32 FEE_BLOCK_FINE_MAX_DURATION,
            uint   MAX_NUM_TOKENS,
            uint   MAX_NUM_ACCOUNTS
        );

    // -- Mode --
    /// @dev Whether the exchange is in withdrawal mode.
    /// @return Returns true if the exchange is in withdrawal mode, else false
    function isInWithdrawalMode()
        external
        view
        returns (bool);

    /// @dev Whether the exchange is shutdown.
    /// @return Returns true if the exchange is shutdown, else false
    function isShutdown()
        external
        view
        returns (bool);

    // -- Accounts --

    /// @dev Gets the number of accounts registered on this exchange.
    /// @return The number of accounts registered
    function getNumAccounts()
        external
        view
        returns (uint);

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
    /// @param  pubKeyY The second part of the account's trading EdDSA public key.
    ///                 Note that pubkeyX and pubKeyY cannot be both `1`.
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

    /// @dev Create a fee receipient account for msg.sender.
    ///      For fee recipient accounts, their pubKeyX and pubKeyY are both `1`.
    /// @return accountID The account's ID
    function createFeeRecipientAccount()
        external
        payable
        returns (uint24 accountID);

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
    /// @param  accountMerkleProof The merkle proof (side node hashes) for the account.
    ///                      The deepest hash in the tree is the 1st element of the array.
    /// @param  balanceMerkleProof he merkle proof (side node hashes) for the balance of the
    ///                      token for the account. The deepest hash in the tree is the
    ///                      1st element of the array.
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
        uint256[20] calldata accountMerkleProof,
        uint256[8]  calldata balanceMerkleProof
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

    /// @dev Withdraws the amount staked for this exchange.
    ///      This can only be done if the exchange has been correctly shutdown:
    ///      - The exchange owner has shutdown the exchange
    ///      - All deposit requests are processed
    ///      - All funds are returned to the users (merkle root is reset to initial state)
    ///
    ///      Can only be called by the exchange owner.
    ///
    /// @return The amount of LRC withdrawn
    function withdrawStake(
        address recipient
        )
        external
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

    /// @dev Get the number of finalized (i.e. irreversible) blocks.
    /// @return The number of finalized blocks which is the index of the last finalized block.
    function getNumBlocksFinalized()
        external
        view
        returns (uint);

    /// @dev Returns the block data for the specified block index.
    /// @param  blockIdx The block index
    /// @return merkleRoot The merkle root
    /// @return publicDataHash The hash of all public data. Used as public input for the ZKP.
    /// @return blockState The current state of the block
    /// @return blockType The type of work done in the block
    /// @return blockSize The number of requests handled in the block
    /// @return timestamp The time the block was committed on-chain
    /// @return blockState The current state of the block
    /// @return numDepositRequestsCommitted The total number of deposit requests committed
    /// @return numWithdrawalRequestsCommitted The total number of withdrawal requests committed
    /// @return blockFeeWithdrawn True if the block fee has been withdrawn, else false
    /// @return numWithdrawalsDistributed The number of withdrawals that have been done for this block
    function getBlock(
        uint blockIdx
        )
        external
        view
        returns (
            bytes32 merkleRoot,
            bytes32 publicDataHash,
            uint8   blockState,
            uint8   blockType,
            uint16  blockSize,
            uint32  timestamp,
            uint32  numDepositRequestsCommitted,
            uint32  numWithdrawalRequestsCommitted,
            bool    blockFeeWithdrawn,
            uint16  numWithdrawalsDistributed
        );

    /// @dev Commit a new block to the virtual blockchain without the proof.
    ///      This function is only callable by the exchange operator.
    ///
    /// @param blockType The type of the new block
    /// @param blockSize The number of onchain or offchain requests/settlements
    ///        that have been processed in this block
    /// @param data The data for this block -
    ///        For all block types:
    ///            - Exchange ID: 4 bytes
    ///            - Old merkle root: 32 bytes
    ///            - New merkle root: 32 bytes
    ///        For RING_SETTLEMENT blocks add the following data:
    ///            - timestamp used in the block: 4 bytes
    ///        For DEPOSIT blocks add the following data:
    ///            - Starting hash: 32 bytes
    ///            - Ending hash: 32 bytes
    ///            - Start index (in deposit chain): 4 bytes
    ///            - Number of deposits processed: 4 bytes
    ///        For ONCHAIN_WITHDRAWAL blocks add the following data:
    ///            - Starting hash: 32 bytes
    ///            - Ending hash: 32 bytes
    ///            - Start index (in withdrawal chain): 4 bytes
    ///            - Number of withdrawals processed: 4 bytes
    ///            - For every withdrawal:
    ///                - Token ID: 1 bytes
    ///                - Account ID: 2,5 bytes
    ///                - Amount: 3,5 bytes
    ///        For OFFCHAIN_WITHDRAWAL blocks add the following data:
    ///            - For every withdrawal:
    ///                - Token ID: 1 bytes
    ///                - Account ID: 2,5 bytes
    ///                - Amount: 3,5 bytes
    ///        For ORDER_CANCELLATION blocks add the following data:
    ///            - None
    ///
    ///        The 'onchain data availability' data (if enabled) is added
    ///        at the end. This allows anyone to recreate the merkle tree
    ///        just by using data published on the Ethereum blockchain.
    ///
    ///        For RING_SETTLEMENT blocks add the following data:
    ///            - Operator account ID: 3 bytes
    ///            - For every ring
    ///                - Ring-matcher account ID: 2,5 bytes
    ///                - Fee-recipient account ID: 2,5 bytes
    ///                - Token ID (fee to operator): 1 bytes
    ///                - Fee amount: 2 bytes
    ///                - Margin (paid by first order): 3 bytes
    ///                - OrderA.orderID: 2,5 bytes
    ///                - OrderB.orderID: 2,5 bytes
    ///                - For both Orders:
    ///                    - Account ID: 2,5 bytes
    ///                    - Wallet account ID: 2,5 bytes
    ///                    - TokenS: 1 bytes
    ///                    - TokenF: 1 bytes
    ///                    - FillS: 3 bytes
    ///                    - FillF: 3 bytes
    ///                    - WalletSplitPercentage: 1 byte
    ///                    - WaiveFeePercentage: 1 byte
    ///        For DEPOSIT blocks add the following data:
    ///            - None
    ///        For ONCHAIN_WITHDRAWAL blocks add the following data:
    ///            - None
    ///        For OFFCHAIN_WITHDRAWALAL blocks add the following data:
    ///            - Operator account ID: 3 bytes
    ///            - For every withdrawal:
    ///                - Wallet account ID: 3 bytes
    ///                - Fee token ID: 1 bytes
    ///                - Fee amount: 2 bytes
    ///                - WalletSplitPercentage: 1 byte
    ///        For ORDER_CANCELLATION blocks add the following data:
    ///            - Operator account ID: 3 bytes
    ///            - For every cancel:
    ///                - Account ID: 2,5 bytes
    ///                - Wallet Account ID: 2,5 bytes
    ///                - Token ID: 1 bytes
    ///                - Order ID: 3 bytes
    ///                - Fee token ID: 1 bytes
    ///                - Fee amount: 2 bytes
    ///                - WalletSplitPercentage: 1 byte
    function commitBlock(
        uint8  blockType,
        uint16 blockSize,
        bytes  calldata data
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
        uint blockIdx
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
    ///      Calling this method with a different trading public key will effectively
    ///      cancel all existing orders within MAX_AGE_REQUEST_UNTIL_FORCED.
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
    ////
    ///      Warning: the DEX UI should warn their users not to deposit more than 2^96 - 1
    ///               tokens in total. If that happens, the user may lose token.
    ///               This token balance upper limit, however, is large enought for most scenarios.
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
    ///      Warning: the DEX UI should warn their users not to deposit more than 2^96 - 1
    ///               tokens in total. If that happens, the user may lose token.
    ///               This token balance upper limit, however, is large enought for most scenarios.
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
            uint32  timestamp
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
        uint96  amount
        )
        external
        payable;

    /// @dev Allows an account owner to withdraw his funds using the balances stored
    ///      in the merkle tree. The funds will be sent to the owner of the acount.
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
        address token,
        uint    pubKeyX,
        uint    pubKeyY,
        uint32  nonce,
        uint96  balance,
        uint256 tradeHistoryRoot,
        uint256[20] calldata accountMerkleProof,
        uint256[8]  calldata balanceMerkleProof
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
        address owner,
        address token,
        uint    pubKeyX,
        uint    pubKeyY,
        uint32  nonce,
        uint96  balance,
        uint256 tradeHistoryRoot,
        uint256[20] calldata accountMerkleProof,
        uint256[8]  calldata balanceMerkleProof
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
    /// @param  depositIdx The index of the deposit request (as given in the
    ///                    depositIdx field in the DepositRequested event)
    function withdrawFromDepositRequest(
        uint depositIdx
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
    ///      This function is only callable by the exchange operator.
    ///
    ///      The block fee can only be withdrawn from finalized blocks
    ///      (i.e. blocks that can never be reverted).
    ///
    /// @param  blockIdx The block index to withdraw the funds for
    /// @param  feeRecipient The address that receives the block fee
    /// @return feeAmount The amount of ETH earned in the block and sent to the operator
    function withdrawBlockFee(
        uint blockIdx,
        address payable feeRecipient
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
    ///      The withdrawals can be done in multiple transactions because the token transfers
    ///      are more expensive than committing and proving a block, so it's possible more
    ///      withdrawals requests are processed in a block than can be distributed
    ///      in an Ethereum block.
    ///      This function will automatically stop distributing the withdrawals when the amount
    ///      of gas left is less than MIN_GAS_TO_DISTRIBUTE_WITHDRAWALS.
    ///      So there are 2 ways to  limit the number of withdrawals:
    ///          - using the maxNumWithdrawals parameter
    ///          - limiting the amount of gas in the transaction
    ///
    /// @param  blockIdx The block index to distribute the funds from the withdrawal requests for
    /// @param  maxNumWithdrawals The max number of withdrawals to distribute. Can be lower than the
    ///         number of withdrawal requests processed in the block. Withdrawals are distributed
    ///         in the same order the withdrawal requests were processed in the block.
    ///         If the withdrawals are done in multiple parts we always start from the
    ///         first withdrawal that was not yet distributed.
    function distributeWithdrawals(
        uint blockIdx,
        uint maxNumWithdrawals
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

    /// @dev Shuts down the exchange.
    ///      Once the exchange is shutdown all onchain requests are permanently disabled.
    ///      When all requirements are fulfilled the exchange owner can withdraw
    ///      the exchange stake with withdrawStake.
    ///
    ///      Note that the exchange can still enter the withdrawal mode after this function
    ///      has been invoked successfully. To prevent entering the withdrawal mode, exchange
    ///      operators need to reset the Merkle tree to its initial state by doingwithdrawals
    ///      within MAX_TIME_IN_SHUTDOWN_BASE + (accounts.length * MAX_TIME_IN_SHUTDOWN_DELTA)
    ///      seconds.
    ///
    ///      Can only be called by the exchange owner.
    ///
    /// @return success True if the exchange is shutdown, else False
    function shutdown()
        external
        returns (bool success);

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
