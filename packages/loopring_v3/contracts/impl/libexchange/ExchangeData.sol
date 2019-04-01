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
        OFFCHAIN_WITHDRAW
    }

    enum BlockState
    {
        // The default state when a new block is included onchain.
        COMMITTED,

        // A valid ZK proof has been submitted for this block.
        VERIFIED,

        // A block's state will become FINALIZED when and only when this block is VERIFIED
        // and all previous block in the chain has become FINAZLIED. The genesis block is
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


    // This is the (virtual) block an operator needs to submit onchain to maitain the
    // per-exchange (virtual) blockchain.

    // TODO(Brecht): please document each field.
    struct Block
    {
        bytes32 merkleRoot;
        bytes32 publicDataHash;  // TODO(brecht): what is this?

        BlockState state;  // TODO(brecht): should we also use uint8 as for blockType?

        uint8  blockType;
        bool   onchainDataAvailability;
        uint16 numElements;
        uint32 timestamp;
        uint32 numDepositRequestsCommitted;
        uint32 numWithdrawRequestsCommitted;
        bool   blockFeeWithdrawn;
        uint16 numWithdrawalsDistributed;
        bytes  withdrawals;
    }

    // Represents the post-state of an onchain deposit/withdrawal request. We can visualize
    // a deposit request -chain and a withdrawal request-chain, each of which is
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

    /// TODO(Brecht): please document this.
    function DEFAULT_ACCOUNT_PUBLICKEY_X() internal pure returns (uint)
    {
        return 2760979366321990647384327991146539505488430080750363450053902718557853404165;
    }

    /// TODO(Brecht): please document this.
    function DEFAULT_ACCOUNT_PUBLICKEY_Y() internal pure returns (uint)
    {
        return 10771439851340068599303586501499035409517957710739943668636844002715618931667;
    }

    /// TODO(Brecht): please document this.
    function DEFAULT_ACCOUNT_SECRETKEY() internal pure returns (uint)
    {
        return 531595266505639429282323989096889429445309320547115026296307576144623272935;
    }

    function MAX_PROOF_GENERATION_TIME_IN_SECONDS() internal pure returns (uint32) { return 1 hours; }
    function MAX_OPEN_REQUESTS() internal pure returns (uint16) { return 1024; }
    function MAX_AGE_REQUEST_UNTIL_FORCED() internal pure returns (uint32) { return 1 days; }
    function MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE() internal pure returns (uint32) { return 1 days; }
    function TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS() internal pure returns (uint32) { return 1 days; }
    function MAX_NUM_TOKENS() internal pure returns (uint) { return 2 ** 12; }
    function MAX_TIME_TO_DISTRIBUTE_WITHDRAWALS() internal pure returns (uint32) { return 2 hours; }

    // Represents the entire exchange state except the owner of the exchange.
    struct State
    {
        uint    id;
        address payable operator; // The only address that can submit new blocks.

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
    }
}