// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.6.10;
pragma experimental ABIEncoderV2;

import "./IBlockVerifier.sol";
import "./IDepositContract.sol";
import "./ILoopringV3.sol";

/// @title ExchangeData
/// @dev All methods in this lib are internal, therefore, there is no need
///      to deploy this library independently.
/// @author Daniel Wang  - <daniel@loopring.org>
/// @author Brecht Devos - <brecht@loopring.org>
library ExchangeData
{
    // -- Enums --
    enum TransactionType
    {
        NOOP,
        DEPOSIT,
        WITHDRAWAL,
        TRANSFER,
        SPOT_TRADE,
        ACCOUNT_NEW,
        ACCOUNT_UPDATE,
        ACCOUNT_TRANSFER
    }

    // -- Structs --
    struct Token
    {
        address token;
    }

    struct ProtocolFeeData
    {
        uint32 syncedAt; // only valid before 2105 (85 years to go)
        uint8  takerFeeBips;
        uint8  makerFeeBips;
        uint8  previousTakerFeeBips;
        uint8  previousMakerFeeBips;
    }

    // General auxiliary data for each conditional transaction
    struct AuxiliaryData
    {
        uint  txIndex;
        bytes data;
    }

    // This is the (virtual) block an operator needs to submit onchain to maintain the
    // per-exchange (virtual) blockchain.
    struct Block
    {
        uint8      blockType;
        uint16     blockSize;
        uint8      blockVersion;
        bytes      data;
        uint256[8] proof;

        // Whether we should store the sha256 hash of the `data` on-chain.
        bool  storeDataHashOnchain;

        // Block specific data that is only used to help process the block on-chain.
        // It is not used as input for the circuits and it is not necessary for data-availability.
        bytes auxiliaryData;

        // Arbitrary data, mainly for off-chain data-availability, i.e.,
        // the multihash of the IPFS file that contains the block data.
        bytes offchainData;
    }

    struct BlockInfo
    {
        bytes32 blockDataHash;
    }

    // Represents an onchain deposit request.
    struct Deposit
    {
        uint96 amount;
        uint32 timestamp; // only valid before 2105 (85 years to go)
        uint64 fee;
    }

    // A forced withdrawal request.
    // If the actual owner of the account initiated the request (we don't know who the owner is
    // at the time the request is being made) the full balance will be withdrawn.
    struct ForcedWithdrawal
    {
        address owner;
        uint32  timestamp;
        uint64  fee;
    }

    struct Constants
    {
        uint SNARK_SCALAR_FIELD;
        uint MAX_OPEN_FORCED_REQUESTS;
        uint MAX_AGE_FORCED_REQUEST_UNTIL_WITHDRAW_MODE;
        uint TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS;
        uint MAX_NUM_ACCOUNTS;
        uint MAX_NUM_TOKENS;
        uint MIN_AGE_PROTOCOL_FEES_UNTIL_UPDATED;
        uint MIN_TIME_IN_SHUTDOWN;
        uint TX_DATA_AVAILABILITY_SIZE;
        uint MAX_AGE_DEPOSIT_UNTIL_WITHDRAWABLE_UPPERBOUND;
    }

    function SNARK_SCALAR_FIELD() internal pure returns (uint) {
        // This is the prime number that is used for the alt_bn128 elliptic curve, see EIP-196.
        return 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    }
    function MAX_OPEN_FORCED_REQUESTS() internal pure returns (uint16) { return 4096; }
    function MAX_AGE_FORCED_REQUEST_UNTIL_WITHDRAW_MODE() internal pure returns (uint32) { return 15 days; }
    function TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS() internal pure returns (uint32) { return 7 days; }
    function MAX_NUM_ACCOUNTS() internal pure returns (uint) { return 2 ** 24; }
    function MAX_NUM_TOKENS() internal pure returns (uint) { return 2 ** 12; }
    function MIN_AGE_PROTOCOL_FEES_UNTIL_UPDATED() internal pure returns (uint32) { return 1 days; }
    function MIN_TIME_IN_SHUTDOWN() internal pure returns (uint32) { return 28 days; }
    function TX_DATA_AVAILABILITY_SIZE() internal pure returns (uint32) { return 104; }
    function MAX_AGE_DEPOSIT_UNTIL_WITHDRAWABLE_UPPERBOUND() internal pure returns (uint32) { return 14 days; }


    struct AccountLeaf
    {
        uint24   accountID;
        address  owner;
        uint     pubKeyX;
        uint     pubKeyY;
        uint32   nonce;
        uint     walletHash;
    }

    struct BalanceLeaf
    {
        uint16   tokenID;
        uint96   balance;
        uint96   index;
        uint     tradeHistoryRoot;
    }

    struct MerkleProof
    {
        ExchangeData.AccountLeaf accountLeaf;
        ExchangeData.BalanceLeaf balanceLeaf;
        uint[36]                 accountMerkleProof;
        uint[18]                 balanceMerkleProof;
    }

    struct BlockContext
    {
        bytes32 DOMAIN_SEPARATOR;
    }

    // Represents the entire exchange state except the owner of the exchange.
    struct State
    {
        uint    id;
        uint    exchangeCreationTimestamp;
        address payable operator; // The only address that can submit new blocks.
        bool    rollupMode;
        uint32  maxAgeDepositUntilWithdrawable;
        bytes32 genesisMerkleRoot;
        bytes32 DOMAIN_SEPARATOR;

        ILoopringV3      loopring;
        IBlockVerifier   blockVerifier;
        IDepositContract depositContract;



        // List of all tokens
        Token[] tokens;

        // List of all blocks
        BlockInfo[] blocks;

        // A map from a token to its tokenID + 1
        mapping (address => uint16) tokenToTokenId;

        // The merkle root of the offchain data stored in a Merkle tree. The Merkle tree
        // stores balances for users using an account model.
        bytes32 merkleRoot;

        // A map from an accountID to a tokenID to if the balance is withdrawn
        mapping (uint24 => mapping (uint16 => bool)) withdrawnInWithdrawMode;

        // A map from an account to a token to the amount withdrawable for that account.
        // This is only used when the automatic distribution of the withdrawal failed.
        mapping (address => mapping (uint16 => uint)) amountWithdrawable;

        // A map from an account to a token to the forced withdrawal (always full balance)
        mapping (uint24 => mapping (uint16 => ForcedWithdrawal)) pendingForcedWithdrawals;

        // A map from an address to a token to an index to a deposit
        mapping (address => mapping (uint16 => mapping (uint => Deposit))) pendingDeposits;

        // A map from an account owner to an approved transaction hash to if the transaction is approved or not
        mapping (address => mapping (bytes32 => bool)) approvedTx;

        // Whitelisted agents
        mapping (address => bool) whitelistedAgent;

        // Agents - A map from an account owner to an agent to a boolean that is true/false depending
        // on if the agent can be used for the account.
        mapping (address => mapping (address => bool)) agent;

        // Counter to keep track of how many of forced requests are open so we can limit the work that needs to be done by the operator
        uint32 numPendingForcedTransactions;

        // Cached data for the protocol fee
        ProtocolFeeData protocolFeeData;

        // Time when the exchange was shutdown
        uint shutdownModeStartTime;

        // Time when the exchange has entered withdrawal mode
        uint withdrawalModeStartTime;

        // Last time the protocol fee was withdrawn for a specific token
        mapping (address => uint) protocolFeeLastWithdrawnTime;
    }
}
