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
        SPOT_TRADE,
        DEPOSIT,
        NEW_ACCOUNT,
        WITHDRAWAL,
        PUBLICKEY_UPDATE,
        TRANSFER
    }

    // -- Structs --
    struct Token
    {
        address            token;
        bool               depositDisabled;
    }

    struct ProtocolFeeData
    {
        uint32 timestamp;
        uint8 takerFeeBips;
        uint8 makerFeeBips;
        uint8 previousTakerFeeBips;
        uint8 previousMakerFeeBips;
    }

    // General auxiliary data for each conditional transaction
    struct AuxiliaryData
    {
        uint txIndex;
        bytes data;
    }

    // Auxiliary data for each withdrawal
    struct WithdrawalAuxiliaryData
    {
        uint gasLimit;
        bytes signature;
    }

    // This is the (virtual) block an operator needs to submit onchain to maintain the
    // per-exchange (virtual) blockchain.
    struct Block
    {
        uint8                  blockType;
        uint16                 blockSize;
        uint8                  blockVersion;
        bytes                  data;
        uint256[8]             proof;

        // Block specific data that is only used to help process the block on-chain.
        // It is not used as input for the circuits and it is not necessary for data-availability.
        bytes                  auxiliaryData;

        // Arbitrary data, mainly for off-chain data-availability, i.e.,
        // the multihash of the IPFS file that contains the block data.
        bytes                  offchainData;
    }

    struct BlockInfo
    {
        bytes32 blockDataHash;
    }

    // Represents an onchain deposit request.  `tokenID` being `0x0` means depositing Ether.
    struct Deposit
    {
        uint96 amount;
        uint32 timestamp;
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
        uint MAX_OPEN_DEPOSIT_REQUESTS;
        uint MAX_OPEN_WITHDRAWAL_REQUESTS;
        uint MAX_AGE_REQUEST_UNTIL_FORCED;
        uint MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE;
        uint MAX_TIME_IN_SHUTDOWN_BASE;
        uint MAX_TIME_IN_SHUTDOWN_DELTA;
        uint TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS;
        uint MAX_NUM_TOKENS;
        uint MAX_NUM_ACCOUNTS;
        uint FEE_BLOCK_FINE_START_TIME;
        uint FEE_BLOCK_FINE_MAX_DURATION;
        uint MIN_AGE_PROTOCOL_FEES_UNTIL_UPDATED;
        uint GAS_LIMIT_SEND_TOKENS;
    }

    function SNARK_SCALAR_FIELD() internal pure returns (uint) {
        // This is the prime number that is used for the alt_bn128 elliptic curve, see EIP-196.
        return 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    }

    function MAX_OPEN_DEPOSIT_REQUESTS() internal pure returns (uint16) { return 1024; }
    function MAX_OPEN_WITHDRAWAL_REQUESTS() internal pure returns (uint16) { return 1024; }
    function MAX_AGE_REQUEST_UNTIL_FORCED() internal pure returns (uint32) { return 14 days; }
    function MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE() internal pure returns (uint32) { return 15 days; }
    function MAX_TIME_IN_SHUTDOWN_BASE() internal pure returns (uint32) { return 30 days; }
    function MAX_TIME_IN_SHUTDOWN_DELTA() internal pure returns (uint32) { return 1 seconds; }
    function TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS() internal pure returns (uint32) { return 7 days; }
    function MAX_NUM_TOKENS() internal pure returns (uint) { return 2 ** 12; }
    function MAX_NUM_ACCOUNTS() internal pure returns (uint) { return 2 ** 24 - 1; }
    function FEE_BLOCK_FINE_START_TIME() internal pure returns (uint32) { return 6 hours; }
    function FEE_BLOCK_FINE_MAX_DURATION() internal pure returns (uint32) { return 6 hours; }
    function MIN_AGE_PROTOCOL_FEES_UNTIL_UPDATED() internal pure returns (uint32) { return 1 days; }
    function MIN_TIME_IN_SHUTDOWN() internal pure returns (uint32) { return 28 days; }
    function TX_DATA_AVAILABILITY_SIZE() internal pure returns (uint32) { return 68; }
    function MAX_AGE_DEPOSIT_UNTIL_WITHDRAWABLE() internal pure returns (uint32) { return 1 days; }


    // Represents the entire exchange state except the owner of the exchange.
    struct State
    {
        uint    id;
        uint    exchangeCreationTimestamp;
        address payable operator; // The only address that can submit new blocks.
        bool    onchainDataAvailability;
        bytes32 genesisMerkleRoot;

        bytes32 DOMAIN_SEPARATOR;

        ILoopringV3      loopring;
        IBlockVerifier   blockVerifier;
        IDepositContract depositContract;

        address lrcAddress;

        uint    totalTimeInMaintenanceSeconds;
        uint    numDowntimeMinutes;
        uint    downtimeStart;

        uint    accountCreationFeeETH;
        uint    accountUpdateFeeETH;
        uint    depositFeeETH;
        uint    withdrawalFeeETH;

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

        // A map from an address to a token to a deposit
        mapping (address => mapping (uint16 => Deposit)) pendingDeposits;

        // A map from an account owner to an approved general hash to a boolean for some transaction
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
        uint shutdownStartTime;

        // Time when the exchange has entered withdrawal mode
        uint withdrawalModeStartTime;
    }
}
