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

    event AddressWhitelistChanged(
        uint    indexed exchangeId,
        address         oldAddressWhitelist,
        address         newAddressWhitelist
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

    event WithdrawalFailed(
        uint24  indexed accountID,
        uint16  indexed tokenID,
        address         to,
        uint96          amount
    );

    event ProtocolFeesUpdated(
        uint8 takerFeeBips,
        uint8 makerFeeBips,
        uint8 previousTakerFeeBips,
        uint8 previousMakerFeeBips
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
    /// @param  pubKeyX The first part of the account's trading EdDSA public key
    /// @param  pubKeyY The second part of the account's trading EdDSA public key.
    ///                 Note that pubkeyX and pubKeyY cannot be both `1`.
    /// @param  permission The operator's signature to allow the creation of new accounts.
    ///                     when `addressWhitelist` is true. For account
    ///                     update, please always set this to `new bytes(0)`.
    /// @return accountID The account's ID
    /// @return isAccountNew True if this account is newly created, false if the account existed
    /// @return isAccountUpdated True if this account was updated, false otherwise
    function createOrUpdateAccount(
        uint  pubKeyX,
        uint  pubKeyY,
        bytes calldata permission
        )
        external
        payable
        returns (
            uint24 accountID,
            bool   isAccountNew,
            bool   isAccountUpdated
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
    /// @param  accountMerkleProof The merkle proof (side node hashes) for the account.
    ///                      The deepest hash in the tree is the 1st element of the array.
    /// @param  balanceMerkleProof he merkle proof (side node hashes) for the balance of the
    ///                      token for the account. The deepest hash in the tree is the
    ///                      1st element of the array.
    /// @return True if the given information is stored in the merkle tree, false otherwise
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
    function getExchangeStake()
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
    function withdrawExchangeStake(
        address recipient
        )
        external
        returns (uint);

    /// @dev Withdraws the amount staked for this exchange.
    ///      This can always be called.
    ///      Can only be called by the exchange owner.
    /// @param  recipient The recipient of the withdrawn LRC
    /// @param  amount The amount of LRC that needs to be withdrawn
    function withdrawProtocolFeeStake(
        address recipient,
        uint    amount
        )
        external;

    /// @dev Can by called by anyone to burn the stake of the exchange when certain
    ///      conditions are fulfilled.
    ///
    ///      Currently this will only burn the stake of the exchange if there are
    ///      unfinalized blocks and the exchange is in withdrawal mode.
    function burnExchangeStake()
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
    /// @param blockVersion The circuit version to use for verifying the block
    /// @param data The data for this block -
    ///        For all block types:
    ///            - Compression type: 1 bytes
    ///            - Exchange ID: 4 bytes
    ///            - Old merkle root: 32 bytes
    ///            - New merkle root: 32 bytes
    ///        For RING_SETTLEMENT blocks add the following data:
    ///            - timestamp used in the block: 4 bytes
    ///            - protocolTakerFeeBips: 1 bytes
    ///            - protocolMakerFeeBips: 1 bytes
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
    ///                - Fee amount: 1,5 bytes
    ///                - Token ID (fee to operator): 1 bytes
    ///                - OrderA.orderID: 2,5 bytes
    ///                - OrderB.orderID: 2,5 bytes
    ///                - OrderA.accountID: 2,5 bytes
    ///                - OrderB.accountID: 2,5 bytes
    ///                - For both Orders:
    ///                    - TokenS: 1 bytes
    ///                    - FillS: 3 bytes
    ///                    - OrderData: isBuyOrder (1 bit) | isRebate (1 bit) |
    ///                                 feeOrRebateBips (6 bits)
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
    ///
    ///        The RING_SETTLEMENT data availability data is further transformed
    ///        to make it more compressible:
    ///        - The Ring-matcher account ID, fee amount and token ID (the first 5 bytes) are
    ///          XORed with the corresponding data from the previous ring
    ///        - To group more similar data together we don't store all data
    ///          for a ring next to each other but group them together for all rings.
    ///          For ALL rings, sequentially:
    ///             - Ring-matcher account ID + fee + Token ID
    ///             - orderA.orderID + orderB.orderID
    ///             - orderA.accountID + orderB.accountID
    ///             - orderA.tokenS + orderB.tokenS
    ///             - orderA.fillS + orderB.fillS
    ///             - orderA.orderData
    ///             - orderB.orderData
    ///
    ///        The data can be sent on-chain compressed. The data will be decompressed respecting the
    ///        Compression type (the first byte in 'data'):
    ///            - Mode 0: No compression. The data following the mode byte is used as is.
    ///            - Mode 1: An IDecompressor address (20 bytes) is stored after the mode byte.
    ///                      IDecompressor.decompress() will be called to decompress the following data.
    /// @param offchainData Arbitrary data, mainly for off-chain data-availability, i.e.,
    ///        the multihash of the IPFS file that contains the block data.
    function commitBlock(
        uint8  blockType,
        uint16 blockSize,
        uint8  blockVersion,
        bytes  calldata data,
        bytes  calldata offchainData
        )
        external;

    /// @dev Submits ZK proofs onchain to verify previously committed blocks. Submitting an
    ///      invalid proof will not change the state of the exchange. Note that proofs can
    ///      be submitted in a different order than the blocks themselves.
    ///
    ///      Multiple blocks can be verified at once (in any order) IF they use the same circuit.
    ///      This function will throw if blocks using different circuits need to be verified.
    ///
    ///      This method can only be called by the operator.
    ///
    /// @param blockIndices The 0-based index of the blocks to be verified with the given proofs
    /// @param proofs The ZK proof for all blockIndices (proofs.length % 8 == 0).
    function verifyBlocks(
        uint[] calldata blockIndices,
        uint[] calldata proofs
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
          uint    accumulatedFee,
          uint32  timestamp
        );

    /// @dev Deposit Ether or ERC20 tokens to the sender's account.
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
    /// @param  pubKeyX The first part of the account's trading EdDSA public key
    /// @param  pubKeyY The second part of the account's trading EdDSA public key
    /// @param  permission The operator's signature to allow the creation of new accounts,
    ///                     when `addressWhitelist` is true. For account
    ///                     updates, please always set this to `new bytes(0)`.
    /// @param  tokenAddress The adderss of the token, use `0x0` for Ether.
    /// @param  amount The amount of tokens to deposit
    /// @return accountID The id of the account
    /// @return isAccountNew True if this account is newly created, false if the account existed
    /// @return isAccountUpdated True if this account was updated, false otherwise
    function updateAccountAndDeposit(
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

    /// @dev Deposit Ether or ERC20 tokens to the sender's account.
    ///
    ///      The total fee in ETH that the user needs to pay is 'depositFee'.
    ///      If the user sends too much ETH the surplus is sent back immediately.
    ///
    ///      Note that after such an operation, it will take the operator some
    ///      time (no more than MAX_AGE_REQUEST_UNTIL_FORCED) to process the request
    ///      and create the deposit to the offchain account.
    ///
    ///      Warning: the DEX UI should warn their users not to deposit more than 2^96 - 1
    ///               tokens in total. If that happens, the user may lose token.
    ///               This token balance upper limit, however, is large enough for most scenarios.
    ///
    /// @param tokenAddress The address of the token, use `0x0` for Ether.
    /// @param amount The amount of tokens to deposit
    function deposit(
        address tokenAddress,
        uint96  amount
        )
        external
        payable;

    /// @dev Deposit Ether or ERC20 tokens to a recipient account.
    ///
    ///      The total fee in ETH that the user needs to pay is 'depositFee'.
    ///      If the user sends too much ETH the surplus is sent back immediately.
    ///
    ///      Note that after such an operation, it will take the operator some
    ///      time (no more than MAX_AGE_REQUEST_UNTIL_FORCED) to process the request
    ///      and create the deposit to the offchain account.
    ///
    ///      Warning: the DEX UI should warn their users not to deposit more than 2^96 - 1
    ///               tokens in total. If that happens, the user may lose token.
    ///               This token balance upper limit, however, is large enough for most scenarios.
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
            uint    accumulatedFee,
            uint32  timestamp
        );

    /// @dev Submit an onchain request to withdraw Ether or ERC20 tokens. To withdraw
    ///      all the balance, use a very large number for `amount`.
    ///
    ///      Only the owner of the account can request a withdrawal.
    ///
    ///      The total fee in ETH that the user needs to pay is 'withdrawalFee'.
    ///      If the user sends too much ETH the surplus is sent back immediately.
    ///
    ///      Note that after such an operation, it will take the operator some
    ///      time (no more than MAX_AGE_REQUEST_UNTIL_FORCED) to process the request
    ///      and create the deposit to the offchain account.
    ///
    /// @param tokenAddress The address of the token, use `0x0` for Ether.
    /// @param amount The amount of tokens to deposit
    function withdraw(
        address tokenAddress,
        uint96  amount
        )
        external
        payable;

    /// @dev Submit an onchain request to withdraw Ether or ERC20 tokens from the
    ///      protocol fees account. The complete balance is always withdrawn.
    ///
    ///      Anyone can request a withdrawal of the protocol fees.
    ///
    ///      Note that after such an operation, it will take the operator some
    ///      time (no more than MAX_AGE_REQUEST_UNTIL_FORCED) to process the request
    ///      and create the deposit to the offchain account.
    ///
    /// @param tokenAddress The address of the token, use `0x0` for Ether.
    function withdrawProtocolFees(
        address tokenAddress
        )
        external
        payable;

    /// @dev Allows an account owner to withdraw his funds using the balances stored
    ///      in the merkle tree. The funds will be sent to the owner of the account.
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
    ///      Can be called by anyone. The withdrawn tokens will be sent to
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
        uint    blockIdx,
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

    /// @dev Set the operator address.
    /// @param _addressWhitelist The new address whitelist address
    /// @return oldOperator The old address whitelist address
    function setAddressWhitelist(
        address _addressWhitelist
        )
        external
        returns (address oldAddressWhitelist);

    /// @dev Update fee settings.
    ///      This function is only callable by the exchange owner.
    /// @param _accountCreationFeeETH The fee in ETH for account creation
    /// @param _accountUpdateFeeETH The fee in ETH for account update
    /// @param _depositFeeETH The fee in ETH for deposits
    /// @param _withdrawalFeeETH The fee in ETH for onchain withdrawal requests
    function updateFees(
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
            uint    _accountCreationFeeETH,
            uint    _accountUpdateFeeETH,
            uint    _depositFeeETH,
            uint    _withdrawalFeeETH
        );

    /// @dev Starts or continues maintenance mode for the specified duration.
    ///      The necessary additional downtime minutes will be purchased. The number of
    ///      downtime minutes still available for use can be checked with getRemainingDowntime().
    ///      In maintenance mode, all onchain user requests, including account creation,
    ///      account update, deposits, and withdrawal requests are disabled.
    ///
    ///      The remaining downtime time will be extended so that the exchange can stay in
    ///      maintenance mode for at least `durationMinutes`.
    ///
    ///      The exchange owner can exit maintenance mode by calling stopMaintenanceMode()
    ///      or by waiting until the remaining downtime is reduced to 0.
    ///
    ///      Once entering the maintenance mode, the operator should still fulfill his duty
    ///      by submitting blocks and proofs until all pending user requests have been taken
    ///      care of within the required timeouts. In the maintenance mode, operator can no longer
    ///      submit settlement blocks.
    ///
    ///      After all pending onchain requests have been handled, the operator can no longer
    ///      submit blocks of any type until maintenance mode is no longer active.
    ///
    ///      This function is only callable by the exchange owner.
    ///
    /// @param durationMinutes The duration in minutes that this exchange can remain in
    ///                        the maintenance mode.
    function startOrContinueMaintenanceMode(
        uint durationMinutes
        )
        external;

    /// @dev Gets the exchange out of maintenance mode.
    ///
    ///      This function is only callable by the exchange owner.
    function stopMaintenanceMode()
        external;

    /// @dev Get the remaining downtime.
    /// @return durationSeconds Remaining downtime in second.
    function getRemainingDowntime()
        external
        view
        returns (uint durationMinutes);

    /// @dev Get the amount of LRC to burn for buying the downtime.
    /// @return costLRC The amount of LRC to burn
    function getDowntimeCostLRC(
        uint durationMinutes
        )
        external
        view
        returns (uint costLRC);

    /// @dev Gets the total amount of time in seconds the exchange has ever been in maintenance.
    /// @return timeInSeconds The total time in maintenance.
    function getTotalTimeInMaintenanceSeconds()
        external
        view
        returns (uint timeInSeconds);

    /// @dev Gets the time the exchange was created.
    /// @return timestamp The time the exchange was created.
    function getExchangeCreationTimestamp()
        external
        view
        returns (uint timestamp);

    /// @dev Shuts down the exchange.
    ///      Once the exchange is shutdown all onchain requests are permanently disabled.
    ///      When all requirements are fulfilled the exchange owner can withdraw
    ///      the exchange stake with withdrawStake.
    ///
    ///      Note that the exchange can still enter the withdrawal mode after this function
    ///      has been invoked successfully. To prevent entering the withdrawal mode, exchange
    ///      operators need to reset the Merkle tree to its initial state by doing withdrawals
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
    /// @return numAvailableDepositSlots The number of slots available for deposits
    /// @return numWithdrawalRequestsProcessed The num of processed withdrawal requests
    /// @return numAvailableWithdrawalSlots The number of slots available for withdrawals
    function getRequestStats()
        external
        view
        returns(
            uint numDepositRequestsProcessed,
            uint numAvailableDepositSlots,
            uint numWithdrawalRequestsProcessed,
            uint numAvailableWithdrawalSlots
        );

    /// @dev Get the protocol fees for this exchange.
    /// @return timestamp The timestamp the protocol fees were last updated
    /// @return takerFeeBips The protocol taker fee
    /// @return makerFeeBips The protocol maker fee
    /// @return previousTakerFeeBips The previous protocol taker fee
    /// @return previousMakerFeeBips The previous protocol maker fee
    function getProtocolFeeValues()
        external
        view
        returns (
            uint32 timestamp,
            uint8 takerFeeBips,
            uint8 makerFeeBips,
            uint8 previousTakerFeeBips,
            uint8 previousMakerFeeBips
        );
}
