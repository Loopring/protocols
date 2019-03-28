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


/// @title IData
/// @author Daniel Wang  - <daniel@loopring.org>
/// @author Brecht Devos - <brecht@loopring.org>
contract IData
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
        COMMITTED,
        VERIFIED,
        FINALIZED
    }

    // -- Structs --
    struct Account
    {
        address owner;
        uint    pubKeyX;
        uint    pubKeyY;
    }

    struct Token
    {
        address token;
        bool    depositDisabled;
    }

    struct Block
    {
        bytes32 merkleRoot;
        bytes32 publicDataHash;

        BlockState state;

        uint8 blockType;
        uint16 numElements;
        uint32 timestamp;
        uint32 numDepositRequestsCommitted;
        uint32 numWithdrawRequestsCommitted;
        bool   blockFeeWithdrawn;
        bytes  withdrawals;
    }

    struct Request
    {
        bytes32 accumulatedHash;
        uint256 accumulatedFee;
        uint32  timestamp;
    }

    struct Deposit
    {
        uint24 accountID;
        uint16 tokenID;
        uint96 amount;
    }


    // == Public Constants ==
    uint    public constant DEFAULT_ACCOUNT_PUBLICKEY_X = 2760979366321990647384327991146539505488430080750363450053902718557853404165;
    uint    public constant DEFAULT_ACCOUNT_PUBLICKEY_Y = 10771439851340068599303586501499035409517957710739943668636844002715618931667;
    uint    public constant DEFAULT_ACCOUNT_SECRETKEY   = 531595266505639429282323989096889429445309320547115026296307576144623272935;

    uint32  public constant MAX_PROOF_GENERATION_TIME_IN_SECONDS        = 1 hours;

    uint32  public constant MAX_OPEN_REQUESTS                           = 256;
    uint32  public constant MAX_AGE_REQUEST_UNTIL_FORCED                = /*15 minutes*/ 1 days;     // TESTING
    uint32  public constant MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE         = 1 days;

    uint32  public constant TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS       = /*1 minutes*/ 1 days;      // TESTING

    uint    public constant MAX_NUM_TOKENS                              = 2 ** 12; // = 4096

    // == State Variables ==

    address payable public operator = address(0);

    address public loopringAddress          = address(0);
    address public lrcAddress               = address(0);
    address public exchangeHelperAddress    = address(0);
    address public blockVerifierAddress     = address(0);

    uint public id = 0;
    uint public disableUserRequestsUntil    = 0;

    uint public accountCreationFeeETH       = 0 ether;
    uint public accountUpdateFeeETH         = 0 ether;
    uint public depositFeeETH               = 0 ether;
    uint public withdrawalFeeETH            = 0 ether;

    Block[]     public blocks;
    Token[]     public tokens;
    Account[]   public accounts;
    Deposit[]   public deposits;
    Request[]   public depositChain;
    Request[]   public withdrawalChain;

    mapping (address => uint24) public ownerToAccountId;
    mapping (address => uint16) public tokenToTokenId;

    // A map from an account owner to a token to if the balance is withdrawn
    mapping (address => mapping (address => bool)) public withdrawnInWithdrawMode;

    // -- Events --
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

    event BlockFeeWithdraw(
        uint32 blockIdx,
        uint amount
    );

    event DepositRequested(
        uint32 depositIdx,
        uint24 accountID,
        uint16 tokenID,
        uint96 amount
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
}