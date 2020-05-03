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
pragma experimental ABIEncoderV2;

import "../iface/IExchange.sol";
import "./ExchangeData.sol";

/// @title IExchangeV3
/// @dev Note that Claimable and RentrancyGuard are inherited here to
///      ensure all data members are declared on IExchangeV3 to make it
///      easy to support upgradability through proxies.
///
///      Subclasses of this contract must NOT define constructor to
///      initialize data.
///
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
abstract contract IExchangeV3 is IExchange
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

    event BlockSubmitted(
        uint    indexed blockIdx,
        bytes32 indexed publicDataHash
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
        uint            amountRewarded,
        uint            amountFined
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

    event ConditionalTransferApproved(
        uint24  indexed from,
        uint24  indexed to,
        uint16          token,
        uint            amount
    );

    event ConditionalTransferConsumed(
        uint24  indexed from,
        uint24  indexed to,
        uint16          token,
        uint            amount
    );

    event AgentAuthorized(
        address indexed owner,
        address indexed agent,
        bool            authorized
    );

    // -- Initialization --
    /// @dev Initializes this exchange. This method can only be called once.
    /// @param  owner The owner of this exchange.
    /// @param  exchangeId The id of this exchange.
    /// @param  operator The operator address of the exchange who will be responsible for
    ///         submitting blocks and proofs.
    /// @param  loopringAddress The corresponding ILoopring contract address.
    /// @param  onchainDataAvailability True if "Data Availability" is turned on for this
    ///         exchange. Note that this value can not be changed once the exchange is initialized.
    function initialize(
        address loopringAddress,
        address owner,
        uint    exchangeId,
        address payable operator,
        bool    onchainDataAvailability
        )
        external
        virtual;

    /// @dev Initialized the deposit contract used by the exchange.
    ///      Can only be called by the exchange owner once.
    /// @param depositContract The deposit contract to be used
    function setDepositContract(address depositContract)
        external
        virtual;

    /// @dev Gets the deposit contract used by the exchange.
    /// @return the deposit contract
    function getDepositContract()
        external
        view
        virtual
        returns (IDepositContract);

    // -- Constants --
    /// @dev Returns a list of constants used by the exchange.
    /// @return constants The list of constants in the following order:
    ///         SNARK_SCALAR_FIELD
    ///         MAX_OPEN_DEPOSIT_REQUESTS
    ///         MAX_OPEN_WITHDRAWAL_REQUESTS
    ///         MAX_AGE_REQUEST_UNTIL_FORCED
    ///         MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE
    ///         MAX_TIME_IN_SHUTDOWN_BASE
    ///         MAX_TIME_IN_SHUTDOWN_DELTA
    ///         TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS
    ///         MAX_NUM_TOKENS
    ///         MAX_NUM_ACCOUNTS
    ///         FEE_BLOCK_FINE_START_TIME
    ///         FEE_BLOCK_FINE_MAX_DURATION
    ///         MIN_AGE_PROTOCOL_FEES_UNTIL_UPDATED
    ///         GAS_LIMIT_SEND_TOKENS
    function getConstants()
        external
        pure
        virtual
        returns(ExchangeData.Constants memory);

    // -- Mode --
    /// @dev Returns hether the exchange is in withdrawal mode.
    /// @return Returns true if the exchange is in withdrawal mode, else false.
    function isInWithdrawalMode()
        external
        view
        virtual
        returns (bool);

    /// @dev Returns whether the exchange is shutdown.
    /// @return Returns true if the exchange is shutdown, else false.
    function isShutdown()
        external
        view
        virtual
        returns (bool);

    /// @dev Returns whether the exchange is in maintenance.
    /// @return Returns true if the exchange is in maintenance, else false.
    function isInMaintenance()
        external
        view
        virtual
        returns (bool);

    // -- Accounts --

    /// @dev Gets the number of accounts registered on this exchange.
    /// @return The number of accounts registered
    function getNumAccounts()
        external
        view
        virtual
        returns (uint);

    /// @dev Gets the account information for a given address.
    /// @param  owner The owning address of the account
    /// @return accountID The account's ID
    /// @return pubKeyX The first part of the account's trading EdDSA public key
    /// @return pubKeyY The second part of the account's trading EdDSA public key
    function getAccount(
        address owner
        )
        external
        view
        virtual
        returns (
            uint24 accountID,
            uint   pubKeyX,
            uint   pubKeyY
        );

    /// @dev Submits an onchain request to create a new account for owner or
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
    ///      Can only be called by an agent.
    ///
    /// @param  owner The owner of the account
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
        payable
        virtual
        returns (
            uint24 accountID,
            bool   isAccountNew,
            bool   isAccountUpdated
        );

    // -- Balances --
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
        uint[36] calldata accountMerkleProof,
        uint[15] calldata balanceMerkleProof
        )
        external
        pure
        virtual
        returns (bool);

    // -- Tokens --

    /// @dev Gets the required amount of LRC to burn for registering one more token.
    /// @return feeLRC The amount of LRC to burn.
    function getLRCFeeForRegisteringOneMoreToken()
        external
        view
        virtual
        returns (uint feeLRC);

    /// @dev Registers an ERC20 token for a token id. Note that different exchanges may have
    ///      different ids for the same ERC20 token.
    ///
    ///      Please note that 1 is reserved for Ether (ETH), 2 is reserved for Wrapped Ether (ETH),
    ///      and 3 is reserved for Loopring Token (LRC).
    ///
    ///      This function is only callable by the exchange owner.
    ///
    /// @param  tokenAddress The token's address
    /// @return tokenID The token's ID in this exchanges.
    function registerToken(
        address tokenAddress
        )
        external
        virtual
        returns (uint16 tokenID);

    /// @dev Returns the id of a registered token.
    /// @param  tokenAddress The token's address
    /// @return tokenID The token's ID in this exchanges.
    function getTokenID(
        address tokenAddress
        )
        external
        view
        virtual
        returns (uint16 tokenID);

    /// @dev Returns the address of a registered token.
    /// @param  tokenID The token's ID in this exchanges.
    /// @return tokenAddress The token's address
    function getTokenAddress(
        uint16 tokenID
        )
        external
        view
        virtual
        returns (address tokenAddress);

    /// @dev Disables users to submit onchain deposit requests for a token.
    ///      This function is only callable by the exchange owner.
    ///
    ///      Can only be called by the exchange owner.
    ///
    /// @param  tokenAddress The token's address
    function disableTokenDeposit(
        address tokenAddress
        )
        external
        virtual;

    /// @dev Enable users to submit onchain deposit requests for a token.
    ///      This function is only callable by the exchange owner.
    ///
    ///      Can only be called by the exchange owner.
    ///
    /// @param  tokenAddress The token's address
    function enableTokenDeposit(
        address tokenAddress
        )
        external
        virtual;

    // -- Stakes --
    /// @dev Gets the amount of LRC the owner has staked onchain for this exchange.
    ///      The stake will be burned if the exchange does not fulfill its duty by
    ///      processing user requests in time. Please note that order matching may potentially
    ///      performed by another party and is not part of the exchange's duty.
    ///
    /// @return The amount of LRC staked
    function getExchangeStake()
        external
        view
        virtual
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
        virtual
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
        external
        virtual;

    /// @dev Can by called by anyone to burn the stake of the exchange when certain
    ///      conditions are fulfilled.
    ///
    ///      Currently this will only burn the stake of the exchange if
    ///      the exchange is in withdrawal mode.
    function burnExchangeStake()
        external
        virtual;

    // -- Blocks --

    /// @dev Gets the current Merkle root of this exchange's virtual blockchain.
    /// @return The current Merkle root.
    function getMerkleRoot()
        external
        view
        virtual
        returns (bytes32);

    /// @dev Gets the height of this exchange's virtual blockchain. The block height for a
    ///      new exchange is 1.
    /// @return The virtual blockchain height which is the index of the last block.
    function getBlockHeight()
        external
        view
        virtual
        returns (uint);

    /// @dev Sumbits new blocks to the rollup blockchain.
    ///
    ///      This function can only be called by the exchange operator.
    ///
    /// @param blocks The blocks being submitted
    ///      - blockType: The type of the new block
    ///      - blockSize: The number of onchain or offchain requests/settlements
    ///        that have been processed in this block
    ///      - blockVersion: The circuit version to use for verifying the block
    ///      - data: The data for this block -
    ///        For all block types:
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
    ///                - Token ID: 2 bytes
    ///                - Account ID: 3 bytes
    ///                - Amount: 3 bytes
    ///        For OFFCHAIN_WITHDRAWAL blocks add the following data:
    ///            - For every withdrawal:
    ///                - Token ID: 2 bytes
    ///                - Account ID: 3 bytes
    ///                - Amount: 3 bytes
    ///        For INTERNAL_TRANSFER blocks add the following data:
    ///            - Number of conditional transfers: 4 bytes
    ///
    ///        The 'onchain data availability' data (if enabled) is added
    ///        at the end. This allows anyone to recreate the Merkle tree
    ///        just by using data published on the Ethereum blockchain.
    ///
    ///        For RING_SETTLEMENT blocks add the following data:
    ///            - Operator account ID: 3 bytes
    ///            - For every ring
    ///                - For both Orders:
    ///                    - accountID: 3 bytes
    ///                    - TokenS: 1,5 bytes
    ///                    - FillS: 3 bytes
    ///                    - OrderData: isBuyOrder (1 bit) | isRebate (1 bit) |
    ///                                 feeOrRebateBips (6 bits)
    ///                    - TradeHistoryData: 0 (1 bit) | overwrite (1 bit) |
    ///                                        tradeHistoryAddress (14 bits)
    ///        For DEPOSIT blocks add the following data:
    ///            - None
    ///        For ONCHAIN_WITHDRAWAL blocks add the following data:
    ///            - None
    ///        For OFFCHAIN_WITHDRAWALAL blocks add the following data:
    ///            - Operator account ID: 3 bytes
    ///            - For every withdrawal:
    ///                - Fee token ID: 2 bytes
    ///                - Fee amount: 2 bytes
    ///        For INTERNAL_TRANSFER blocks add the following data:
    ///            - Operator account ID: 3 bytes
    ///            - For every transfer:
    ///                - Type: 1 byte (0: signature available, 1: conditional transfer)
    ///                - From account ID: 3 bytes
    ///                - To account ID: 3 bytes
    ///                - Token ID: 1,5 byte
    ///                - Fee token ID: 1,5 byte
    ///                - Amount: 3 bytes
    ///                - Fee: 2 bytes
    ///
    ///        The RING_SETTLEMENT data availability data is further transformed
    ///        to make it more compressible:
    ///        - To group more similar data together we don't store all data
    ///          for a ring next to each other but group them together for all rings.
    ///          For ALL rings, sequentially:
    ///             - orderA.tradeHistoryData + orderB.tradeHistoryData
    ///             - orderA.accountID + orderB.accountID
    ///             - orderA.tokenS + orderB.tokenS
    ///             - orderA.fillS + orderB.fillS
    ///             - orderA.orderData
    ///             - orderB.orderData
    ///
    ///     - offchainData: Arbitrary data, mainly for off-chain data-availability, i.e.,
    ///        the multihash of the IPFS file that contains the block data.
    /// @param feeRecipient The address that will receive the onchain block rewards
    function submitBlocks(
        ExchangeData.Block[] calldata blocks,
        address payable feeRecipient
        )
        external
        virtual;

    // -- Deposits --
    /// @dev Returns the index of the first deposit request that wasn't yet included
    ///      in a block. Can be used to check if a deposit with a given depositIdx
    ///      (as specified in the DepositRequested event) was processed by the operator.
    /// @return The num of the processed deposit requests
    function getNumDepositRequestsProcessed()
        external
        view
        virtual
        returns (uint);

    /// @dev Gets the number of available onchain deposit slots.
    /// @return The number of slots avalable for deposits.
    function getNumAvailableDepositSlots()
        external
        view
        virtual
        returns (uint);

    /// @dev Gets an item from deposit request-chain.
    /// @param index The 0-based index of the request
    /// @return accumulatedHash See @Request
    /// @return accumulatedFee  See @Request
    /// @return timestamp       See @Request
    function getDepositRequest(
        uint index
        )
        external
        view
        virtual
        returns (
          bytes32 accumulatedHash,
          uint    accumulatedFee,
          uint32  timestamp
        );

    /// @dev Deposits Ether or ERC20 tokens to the owner's account.
    ///
    ///      This function is only callable by an agent of the account.
    ///
    ///      This function will create a new account if no account exists
    ///      for owner, or update the existing account with the given trading
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
    /// @param  owner The owner of the account
    /// @param  pubKeyX The first part of the account's trading EdDSA public key
    /// @param  pubKeyY The second part of the account's trading EdDSA public key
    /// @param  permission Data used for checking address whitelisting prior to
    ///                    account creation.
    /// @param  tokenAddress The adderss of the token, use `0x0` for Ether.
    /// @param  amount The amount of tokens to deposit
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
        virtual
        returns (
            uint24 accountID,
            bool   isAccountNew,
            bool   isAccountUpdated
        );

    /// @dev Deposits Ether or ERC20 tokens to the specified account.
    ///
    ///      This function is only callable by an agent of 'from'.
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
    /// @param from The address that deposits the funds to the exchange
    /// @param to The account owner's address receiving the funds
    /// @param tokenAddress The address of the token, use `0x0` for Ether.
    /// @param amount The amount of tokens to deposit
    function deposit(
        address from,
        address to,
        address tokenAddress,
        uint96  amount
        )
        external
        payable
        virtual;

    // -- Withdrawals --

    /// @dev Returns the index of the first withdrawal request that wasn't yet included
    ///      in a block. Can be used to check if a withdrawal with a given withdrawalIdx
    ///      (as specified in the WithdrawalRequested event) was processed by the operator.
    /// @return The num of processed withdrawal requests
    function getNumWithdrawalRequestsProcessed()
        external
        view
        virtual
        returns (uint);

    /// @dev Gets the number of available onchain withdrawal slots.
    /// @return The number of slots available for withdrawals
    function getNumAvailableWithdrawalSlots(
        )
        external
        view
        virtual
        returns (uint);

    /// @dev Gets an item from withdrawal request-chain.
    /// @param index The 0-based index of the request
    /// @return accumulatedHash See @Request
    /// @return accumulatedFee  See @Request
    /// @return timestamp       See @Request
    function getWithdrawRequest(
        uint index
        )
        external
        view
        virtual
        returns (
            bytes32 accumulatedHash,
            uint    accumulatedFee,
            uint32  timestamp
        );

    /// @dev Submits an onchain request to withdraw Ether or ERC20 tokens. To withdraw
    ///      the complete balance, use a very large number for `amount`.
    ///
    ///      This function is only callable by an agent of the account.
    ///
    ///      The total fee in ETH that the user needs to pay is 'withdrawalFee'.
    ///      If the user sends too much ETH the surplus is sent back immediately.
    ///
    ///      Note that after such an operation, it will take the operator some
    ///      time (no more than MAX_AGE_REQUEST_UNTIL_FORCED) to process the request
    ///      and create the deposit to the offchain account.
    ///
    /// @param owner The address of the owner.
    /// @param tokenAddress The address of the token, use `0x0` for Ether.
    /// @param amount The amount of tokens to deposit
    function withdraw(
        address owner,
        address tokenAddress,
        uint96  amount
        )
        external
        payable
        virtual;

    /// @dev Submits an onchain request to withdraw Ether or ERC20 tokens from the
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
        payable
        virtual;

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
    function withdrawFromMerkleTree(
        address  owner,
        address  token,
        uint     pubKeyX,
        uint     pubKeyY,
        uint32   nonce,
        uint96   balance,
        uint     tradeHistoryRoot,
        uint[36] calldata accountMerkleProof,
        uint[15] calldata balanceMerkleProof
        )
        external
        virtual;

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
        external
        virtual;

    /// @dev Allows withdrawing funds after a withdrawal request (either onchain
    ///      or offchain) was submitted in a block by the operator.
    ///
    ///      Can be called by anyone. The withdrawn tokens will be sent to
    ///      the owner of the account they were withdrawn out.
    ///
    ///      Normally it is should not be needed for users to call this manually.
    ///      Funds from withdrawal requests will be sent to the account owner
    ///      immediately by the operator when the block is submitted.
    ///      The user will however need to call this manually if the transfer failed.
    ///
    /// @param  owner The address of the account the withdrawal was done for.
    /// @param  token The token address
    function withdrawFromApprovedWithdrawal(
        address owner,
        address token
        )
        external
        virtual;

    /// @dev Gets the amount that can be withdrawn immediately with `withdrawFromApprovedWithdrawal`.
    /// @param  owner The address of the account the withdrawal was done for.
    /// @param  token The token address
    /// @return The amount withdrawable
    function getAmountWithdrawable(
        address owner,
        address token
        )
        external
        view
        virtual
        returns (uint);

    // -- Agents --

    /// @dev Authorizes/Deauthorizes agents for an account.
    ///      An agent is allowed to authorize onchain operations for the account owner.
    ///      By definition the account owner is an agent for himself.
    ///
    ///      This function can only be called by an agent.
    ///
    /// @param owner The account owner.
    /// @param agents The agents to be authorized/deauthorized.
    /// @param authorized True to authorize the agent, false to deauthorize
    function authorizeAgents(
        address   owner,
        address[] calldata agents,
        bool[]    calldata authorized
        )
        external
        virtual;

    /// @dev Returns whether an agent address is an agent of an account owner
    /// @param owner The account owner.
    /// @param agent The agent address
    /// @return True if the agent address is an agent for the account owner, else false
    function isAgent(address owner, address agent)
        public
        view
        virtual
        returns (bool);

    /// @dev Approves an offchain transfer.
    ///      Important! This is just an approval, the operator has full control
    ///      whether the transfer will actally be done!
    ///
    ///      This function can only be called by an agent.
    ///
    /// @param from The address of the account that sends the tokens.
    /// @param to The address to which 'amount' tokens are transferred.
    /// @param token The address of the token to transfer ('0x0' for ETH).
    /// @param amount The amount of tokens to be transferred.
    function approveOffchainTransfer(
        address from,
        address to,
        address token,
        uint    amount
        )
        external
        virtual;

    /// @dev Gets the currently approved amounts to be transferred using internal transfers.
    /// @param from The address of the account that sends the tokens.
    /// @param to The address to which 'amount' tokens are transferred.
    /// @param token The address of the token to transfer ('0x0' for ETH).
    /// @return The amount approved
    function getApprovedTransferAmount(
        address from,
        address to,
        address token
        )
        external
        view
        virtual
        returns (uint);

    /// @dev Allows an agent to transfer ERC-20 tokens for a user using the allowance
    ///      the user has set for the exchange. This way the user only needs to approve a single exchange contract
    ///      for all exchange/agent features, which allows for a more seamless user experience.
    ///
    ///      This function can only be called by an agent.
    ///
    /// @param from The address of the account that sends the tokens.
    /// @param to The address to which 'amount' tokens are transferred.
    /// @param token The address of the token to transfer (ETH is and cannot be suppported).
    /// @param amount The amount of tokens transferred.
    function onchainTransferFrom(
        address from,
        address to,
        address token,
        uint    amount
        )
        external
        virtual;

    // -- Admins --

    /// @dev Sets the operator address.
    /// @param _operator The new operator's address
    /// @return oldOperator The old operator's address
    function setOperator(
        address payable _operator
        )
        external
        virtual
        returns (address payable oldOperator);

    /// @dev Gets the operator address.
    /// @return The current operator
    function getOperator()
        external
        view
        virtual
        returns (address payable);

    /// @dev Sets the address whitelist contract address.
    ///      Can only be called by the exchange owner.
    /// @param _addressWhitelist The new address whitelist contract address
    /// @return oldAddressWhitelist The old address whitelist contract address
    function setAddressWhitelist(
        address _addressWhitelist
        )
        external
        virtual
        returns (address oldAddressWhitelist);

    /// @dev Updates fee settings.
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
        external
        virtual;

    /// @dev Gets current fee settings.
    /// @return _accountCreationFeeETH The fee in ETH for account creation
    /// @return _accountUpdateFeeETH The fee in ETH for account update
    /// @return _depositFeeETH The fee in ETH for deposits
    /// @return _withdrawalFeeETH The fee in ETH for onchain withdrawal requests
    function getFees()
        external
        view
        virtual
        returns (
            uint _accountCreationFeeETH,
            uint _accountUpdateFeeETH,
            uint _depositFeeETH,
            uint _withdrawalFeeETH
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
        external
        virtual;

    /// @dev Gets the exchange out of maintenance mode.
    ///
    ///      This function is only callable by the exchange owner.
    function stopMaintenanceMode()
        external
        virtual;

    /// @dev Gets the remaining downtime.
    /// @return durationMinutes Remaining downtime in minutes.
    function getRemainingDowntime()
        external
        view
        virtual
        returns (uint durationMinutes);

    /// @dev Gets the amount of LRC to burn for buying the downtime.
    /// @return costLRC The amount of LRC to burn
    function getDowntimeCostLRC(
        uint durationMinutes
        )
        external
        view
        virtual
        returns (uint costLRC);

    /// @dev Gets the total amount of time in seconds the exchange has ever been in maintenance.
    /// @return timeInSeconds The total time in maintenance.
    function getTotalTimeInMaintenanceSeconds()
        external
        view
        virtual
        returns (uint timeInSeconds);

    /// @dev Gets the time the exchange was created.
    /// @return timestamp The time the exchange was created.
    function getExchangeCreationTimestamp()
        external
        view
        virtual
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
        virtual
        returns (bool success);

    /// @dev Gets number of available/processed deposits/withdrawals.
    /// @return numDepositRequestsProcessed The num of the processed deposit requests
    /// @return numAvailableDepositSlots The number of slots available for deposits
    /// @return numWithdrawalRequestsProcessed The num of processed withdrawal requests
    /// @return numAvailableWithdrawalSlots The number of slots available for withdrawals
    function getRequestStats()
        external
        view
        virtual
        returns(
            uint numDepositRequestsProcessed,
            uint numAvailableDepositSlots,
            uint numWithdrawalRequestsProcessed,
            uint numAvailableWithdrawalSlots
        );

    /// @dev Gets the protocol fees for this exchange.
    /// @return timestamp The timestamp the protocol fees were last updated
    /// @return takerFeeBips The protocol taker fee
    /// @return makerFeeBips The protocol maker fee
    /// @return previousTakerFeeBips The previous protocol taker fee
    /// @return previousMakerFeeBips The previous protocol maker fee
    function getProtocolFeeValues()
        external
        view
        virtual
        returns (
            uint32 timestamp,
            uint8 takerFeeBips,
            uint8 makerFeeBips,
            uint8 previousTakerFeeBips,
            uint8 previousMakerFeeBips
        );
}
