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

    // uint    public constant DEFAULT_ACCOUNT_PUBLICKEY_X = 2760979366321990647384327991146539505488430080750363450053902718557853404165;
    // uint    public constant DEFAULT_ACCOUNT_PUBLICKEY_Y = 10771439851340068599303586501499035409517957710739943668636844002715618931667;
    // uint    public constant DEFAULT_ACCOUNT_SECRETKEY   = 531595266505639429282323989096889429445309320547115026296307576144623272935;

    // uint32  public constant MAX_PROOF_GENERATION_TIME_IN_SECONDS        = 1 hours;

    // uint32  public constant MAX_AGE_REQUEST_UNTIL_FORCED                = /*15 minutes*/ 1 days;     // TESTING
    // uint32  public constant MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE         = 1 days;

    // uint32  public constant TIMESTAMP_WINDOW_SIZE_IN_SECONDS            = /*1 minutes*/ 1 days;        // TESTING

    // uint16  public constant NUM_DEPOSITS_IN_BLOCK                       = 8;
    // uint16  public constant NUM_WITHDRAWALS_IN_BLOCK                    = 8;
    // uint    public constant MAX_NUM_TOKENS                              = 2 ** 12; // = 4096

    function DEFAULT_ACCOUNT_PUBLICKEY_X() public pure returns (uint) { return 2760979366321990647384327991146539505488430080750363450053902718557853404165; }
    function DEFAULT_ACCOUNT_PUBLICKEY_Y() public pure returns (uint) { return 10771439851340068599303586501499035409517957710739943668636844002715618931667; }
    function DEFAULT_ACCOUNT_SECRETKEY() public pure returns (uint) { return 531595266505639429282323989096889429445309320547115026296307576144623272935; }

    function MAX_PROOF_GENERATION_TIME_IN_SECONDS() public pure returns (uint32) { return 1 hours; }
    function MAX_AGE_REQUEST_UNTIL_FORCED() public pure returns (uint32) { return 1 days; }
    function MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE() public pure returns (uint32) { return 1 days; }
    function TIMESTAMP_WINDOW_SIZE_IN_SECONDS() public pure returns (uint32) { return 1 days; }
    function NUM_DEPOSITS_IN_BLOCK() public pure returns (uint16) { return 8; }
    function NUM_WITHDRAWALS_IN_BLOCK() public pure returns (uint16) { return 8; }
    function MAX_NUM_TOKENS() public pure returns (uint) { return 2 **12; }


    struct State
    {
        uint id;
        address owner;
        address payable operator;

        address loopring3Address;
        address lrcAddress;
        address exchangeHelperAddress;
        address blockVerifierAddress;

        uint disableUserRequestsUntil;

        uint accountCreationFeeETH;
        uint accountUpdateFeeETH;
        uint depositFeeETH;
        uint withdrawalFeeETH;

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