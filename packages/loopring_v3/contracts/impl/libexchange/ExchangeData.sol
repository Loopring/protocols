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

import "../../iface/IBlockVerifier.sol";
import "../../iface/ILoopringV3.sol";


/// @title ExchangeData
/// @author Daniel Wang  - <daniel@loopring.org>
/// @author Brecht Devos - <brecht@loopring.org>

library ExchangeData
{
    // -- Enums --
    enum BlockType
    {
        SETTLEMENT,
        DEPOSIT,
        ONCHAIN_WITHDRAW,
        OFFCHAIN_WITHDRAW,
        CANCEL
    }

    enum BlockState
    {
        // The default state when a new block is included onchain.
        COMMITTED,

        // A valid ZK proof has been submitted for this block.
        VERIFIED,

        // A block's state will become FINALIZED when and only when this block is VERIFIED
        // and all previous blocks in the chain have become FINAZLIED. The genesis block is
        // FINAZLIED by default.
        FINALIZED
    }

    // -- Structs --
    struct Account
    {
        address owner;

        // pubKeyX and pubKeyY put together is the EdDSA public trading key. Users or their
        // wallet software are supposed to manage the corresponding private key for signing
        // orders and offchain requests.
        //
        // We use EdDSA because it is more circuit friendly than ECDSA. In later versionsk
        // we may switch back to ECDSA, then we will not need such a dedicated tradig key-pair.
        //
        // We split the public key into two uint to make it more circuit friendly.
        uint    pubKeyX;
        uint    pubKeyY;
    }

    struct Token
    {
        address token;
        bool    depositDisabled;
    }


    // This is the (virtual) block an operator needs to submit onchain to maintain the
    // per-exchange (virtual) blockchain.
    struct Block
    {
        // The merkle root of the offchain data stored in a merkle tree. The merkle tree
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

        // The type of the block (i.e. what kind of requests were processed).
        // See @BlockType for more information.
        uint8  blockType;

        // The number of requests processed in the block. Only a limited number of permutations
        // are available for each block type (because each will need a different circuit
        // and thus different verification key onchain). Use IBlockVerifier.canVerify to find out if
        // the block is supported.
        uint16 numElements;

        // The time the block was created.
        uint32 timestamp;

        // The number of onchain deposit requests that have been processed
        // up to and including this block.
        uint32 numDepositRequestsCommitted;

        // The number of onchain withdrawal requests that have been processed
        // up to and including this block.
        uint32 numWithdrawalRequestsCommitted;

        // Stores whether the fee earned by the operator for processing onchain requests
        // is withdrawn or not.
        bool   blockFeeWithdrawn;

        // Number of withdrawals distributed using `distributeWithdrawals`
        uint16 numWithdrawalsDistributed;

        // The approved withdrawal data. Needs to be stored onchain so this data is available
        // once the block is finalized and the funds can be withdrawn using the info stored
        // in this data.
        // For every withdrawal (there are numElements withdrawals),
        // stored sequentially after each other:
        //    - Account ID: 3 bytes
        //    - Token ID: 2 bytes
        //    - Amount: 12 bytes
        bytes  withdrawals;
    }

    // Represents the post-state of an onchain deposit/withdrawal request. We can visualize
    // a deposit request-chain and a withdrawal request-chain, each of which is
    // composed of such Request objects. Please refer to the design doc for more details.
    struct Request
    {
        bytes32 accumulatedHash;
        uint256 accumulatedFee;
        uint32  timestamp;
    }

    // Represents an onchain deposit request.  `tokenID` being `0x0` means depositing Ether.
    struct Deposit
    {
        uint24 accountID;
        uint16 tokenID;
        uint96 amount;
    }

    function MAX_PROOF_GENERATION_TIME_IN_SECONDS() internal pure returns (uint32) { return 1 hours; }
    function MAX_OPEN_DEPOSIT_REQUESTS() internal pure returns (uint16) { return 1024; }
    function MAX_OPEN_WITHDRAWAL_REQUESTS() internal pure returns (uint16) { return 1024; }
    function MAX_AGE_UNFINALIZED_BLOCK_UNTIL_WITHDRAW_MODE() internal pure returns (uint32) { return 1 days; }
    function MAX_AGE_REQUEST_UNTIL_FORCED() internal pure returns (uint32) { return 1 days; }
    function MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE() internal pure returns (uint32) { return 1 days; }
    function TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS() internal pure returns (uint32) { return 1 days; }
    function MAX_NUM_TOKENS() internal pure returns (uint) { return 2 ** 12; }
    function MAX_TIME_TO_DISTRIBUTE_WITHDRAWALS() internal pure returns (uint32) { return 2 hours; }
    function FEE_BLOCK_FINE_START_TIME() internal pure returns (uint32) { return 5 minutes; }
    function FEE_BLOCK_FINE_MAX_DURATION() internal pure returns (uint32) { return 30 minutes; }

    // Represents the entire exchange state except the owner of the exchange.
    struct State
    {
        uint    id;
        address payable operator; // The only address that can submit new blocks.
        bool    onchainDataAvailability;

        ILoopringV3    loopring;
        IBlockVerifier blockVerifier;

        address lrcAddress;

        uint    disableUserRequestsUntil;
        uint    accountCreationFeeETH;
        uint    accountUpdateFeeETH;
        uint    depositFeeETH;
        uint    withdrawalFeeETH;

        Block[]     blocks;
        Token[]     tokens;
        Account[]   accounts;
        Deposit[]   deposits;
        Request[]   depositChain;
        Request[]   withdrawalChain;

        mapping (address => uint24) ownerToAccountId;
        mapping (address => uint16) tokenToTokenId;

        // A map from an account owner to a token to if the balance is withdrawn
        mapping (address => mapping (address => bool)) withdrawnInWithdrawMode;

        uint numBlocksFinalized;
    }
}