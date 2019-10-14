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

import "../../iface/ILoopringV3.sol";
import "../../iface/IExchangeModule.sol";
import "../../iface/IVerificationKeyProvider.sol";


/// @title ExchangeData
/// @dev All methods in this lib are internal, therefore, there is no need
///      to deploy this library independently.
/// @author Daniel Wang  - <daniel@loopring.org>
/// @author Brecht Devos - <brecht@loopring.org>
library ExchangeData
{
    // -- Enums --
    enum BlockState
    {
        // This value should never be seen onchain, but we want to reserve 0 so the
        // relayer can use this as the default for new blocks.
        NEW,            // = 0

        // The default state when a new block is included onchain.
        COMMITTED,      // = 1

        // A valid ZK proof has been submitted for this block.
        // The genesis block is VERIFIED by default.
        VERIFIED        // = 2
    }

    // -- Structs --
    struct Account
    {
        address owner;
        uint24  id;

        // pubKeyX and pubKeyY put together is the EdDSA public trading key. Users or their
        // wallet software are supposed to manage the corresponding private key for signing
        // orders and offchain requests.
        //
        // We use EdDSA because it is more circuit friendly than ECDSA. In later versions
        // we may switch back to ECDSA, then we will not need such a dedicated tradig key-pair.
        //
        // We split the public key into two uint to make it more circuit friendly.
        uint    pubKeyX;
        uint    pubKeyY;
    }

    struct Token
    {
        address token;
        uint16  id;
        bool    depositDisabled;
    }

    // This is the (virtual) block an operator needs to submit onchain to maintain the
    // per-exchange (virtual) blockchain.
    struct Block
    {
        // The merkle root of the offchain data stored in a Merkle tree. The Merkle tree
        // stores balances for users using an account model.
        bytes32 merkleRoot;

        // The hash of all the public data sent in commitBlock. Committing a block
        // is decoupled from the verification of a block, but we don't want to send
        // the (often) large amount of data (certainly with onchain data availability) again
        // when verifying the proof, so we hash all that data onchain in commitBlock so that we
        // can use it in verifyBlock to verify the block. This also makes the verification cheaper
        // onchain because we only have this single public input.
        bytes32 publicDataHash;

        // The current state of the block. See @BlockState for more information.
        BlockState state;

        // The exchange module that committed this block.
        IExchangeModule module;

        // The number of requests processed in the block. Only a limited number of permutations
        // are available for each block type (because each will need a different circuit
        // and thus different verification key onchain).
        uint32 blockSize;

        // The block version (i.e. what circuit version needs to be used to verify the block).
        uint16 blockVersion;

        // The time the block was created.
        uint32 timestamp;

        // The Ethereum block the block was created in.
        uint32 ethereumBlockNumber;
    }

    struct Module
    {
        IExchangeModule module;
    }

    function SNARK_SCALAR_FIELD() internal pure returns (uint) {
        // This is the prime number that is used for the alt_bn128 elliptic curve, see EIP-196.
        return 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    }
    function MAX_PROOF_GENERATION_TIME_IN_SECONDS() internal pure returns (uint32) { return 1 hours; }
    function MAX_GAP_BETWEEN_FINALIZED_AND_VERIFIED_BLOCKS() internal pure returns (uint32) { return 2500; }
    function MAX_AGE_UNFINALIZED_BLOCK_UNTIL_WITHDRAW_MODE() internal pure returns (uint32) { return 1 days; }
    function MAX_TIME_IN_SHUTDOWN_BASE() internal pure returns (uint32) { return 1 days; }
    function MAX_TIME_IN_SHUTDOWN_DELTA() internal pure returns (uint32) { return 15 seconds; }
    function MAX_NUM_TOKENS() internal pure returns (uint) { return 2 ** 8; }
    function MAX_NUM_ACCOUNTS() internal pure returns (uint) { return 2 ** 20 - 1; }
    function MIN_TIME_UNTIL_EXCHANGE_STAKE_IS_WITHDRAWABLE() internal pure returns (uint32) { return 1 days; }
    function MAX_GAS_USE_MODULE_STATUS_CHECKING() internal pure returns (uint32) { return 100000; }
    function MAX_TOKEN_BALANCE() internal pure returns (uint96) { return 2 ** 96 - 1; }

    // Represents the entire exchange state except the owner of the exchange.
    struct State
    {
        uint    id;
        uint    exchangeCreationTimestamp;
        address payable operator; // The only address that can submit new blocks.
        bool    onchainDataAvailability;

        ILoopringV3    loopring;

        address lrcAddress;

        uint    totalTimeInMaintenanceSeconds;
        uint    numDowntimeMinutes;
        uint    downtimeStart;

        Block[]     blocks;
        Token[]     tokens;
        Account[]   accounts;

        // A map from the account owner to accountID + 1
        mapping (address => uint24) ownerToAccountId;
        mapping (address => uint16) tokenToTokenId;

        // A map from an account owner to a token to if the balance is withdrawn
        mapping (address => mapping (address => bool)) withdrawnInWithdrawMode;

        // A map from token address to their accumulated balances
        mapping (address => uint) tokenBalances;

        // Exchange modules
        Module[] modules;
        // A map from the exchange module to the position + 1 in the modules array
        mapping (address => uint) addressToModuleMap;

        // A block's state will become FINALIZED when and only when this block is VERIFIED
        // and all previous blocks in the chain have become FINALIZED.
        // The genesis block is FINALIZED by default.
        uint numBlocksFinalized;

        // Time when the exchange was shutdown
        uint shutdownStartTime;

        // True if the exchange is in withdrawal mode
        bool inWithdrawalMode;
    }
}
