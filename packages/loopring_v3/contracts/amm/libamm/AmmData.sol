// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../core/iface/ExchangeData.sol";
import "../../core/iface/IExchangeV3.sol";


/// @title AmmData
library AmmData
{
    function LP_TOKEN_BASE() internal pure returns (uint) { return 10 ** 18; }
    function LP_TOKEN_INITIAL_SUPPLY() internal pure returns (uint) { return 100 * LP_TOKEN_BASE(); }
    function MAX_AGE_REQUEST_UNTIL_POOL_SHUTDOWN() internal pure returns (uint) { return 7 days; }
    function MAX_NUM_EXITS_FROM_LAYER1() internal pure returns (uint) { return 200; }
    function LOCK_DELAY() internal pure returns (uint) { return 1 days; }

    enum PoolTxType
    {
        NOOP,
        JOIN,
        EXIT
    }

    struct PoolConfig
    {
        address   exchange;
        string    poolName;
        uint32    accountID;
        address[] tokens;
        uint96[]  weights;
        uint8     feeBips;
        string    tokenSymbol;
        uint      onchainExitFeeETH;
    }

    struct PoolJoin
    {
        address   owner;
        bool      joinFromLayer2;
        uint96[]  joinAmounts;
        uint96[]  joinFees;
        uint32[]  joinStorageIDs;
        bool      mintToLayer2;
        uint96    mintMinAmount;
        uint      validUntil;
        uint32    nonce; // For a layer2 join, the nonce must be 0;
                         // For a layer1 join, the nonce is index of the user's TokenLock in joinLocks plus 1.
    }

    struct PoolExit
    {
        address   owner;
        bool      burnFromLayer2;
        uint96    burnAmount;
        uint32    burnStorageID; // for pool token withdrawal from user to the pool
        bool      exitToLayer2;
        uint96[]  exitMinAmounts;
        uint      validUntil;
        uint32    nonce; // For a layer2 exit, the nonce must be 0;
                         // For a layer1 exit, the nonce is index of the TokenLock in exitLocks plus 1.
    }

    struct TokenLock
    {
        bytes32  txHash;
        uint96[] amounts; // the size should be either 1 or tokens.length - 1
    }

    struct PoolTx
    {
        PoolTxType txType;
        bytes               data;
        bytes               signature;
    }

    struct Token
    {
        address addr;
        uint96  weight;
        uint16  tokenID;
    }

    struct Context
    {
        // functional parameters
        ExchangeData.Block _block;
        uint               txIdx;

        // Exchange state variables
        IExchangeV3 exchange;
        bytes32     exchangeDomainSeparator;
        address     feeRecipient;

        // AMM pool state variables
        bytes32 domainSeparator;
        uint32  accountID;

        Token[] tokens;

        uint    poolTokenBase;
        uint    poolTokenInitialSupply;
        uint    size; // == token.length;

        uint96[] ammActualL2Balances;
        uint96[] ammExpectedL2Balances;
        uint     numTransactionsConsumed;
        uint     totalSupply;
    }

    struct State {
        // Pool token state variables
        string poolName;
        string symbol;
        uint   totalSupply;
        uint   poolSupplyToBurn;

        mapping(address => uint) balanceOf;
        mapping(address => mapping(address => uint)) allowance;
        mapping(address => uint) nonces;

        // AMM pool state variables
        IExchangeV3 exchange;
        uint32      accountID;
        uint        onchainExitFeeETH;
        bytes32     domainSeparator;
        uint        shutdownTimestamp;
        uint8       feeBips;
        Token[]     tokens;

        // A map from a token address to a user address to the balance the user can be
        // withdrawan from this pool account on layer-1.
        mapping (address => mapping (address => uint96)) withdrawable;

        // A map from a token address to the amount owned collectively by all users
        // on layer1 before the pool is shutdown.
        mapping (address => uint) withdrawableBeforeShutdown;

        // A map of approved transaction hashes to the timestamp it was created
        mapping (bytes32 => uint) approvedTx;

        // A map from a user address to whether it has a pending onchain exit.
        mapping (address => bool) isExiting;

        // A list of global onchain exit locks
        TokenLock[] exitLocks;

        // The index of the first pending onchain exit lock.
        uint exitLocksStartIdx;

        // A map from a user address to a list of join locks.
        mapping (address => TokenLock[]) joinLocks;

        // A map from a user to the index of his/her first pending onchain join lock.
        mapping (address => uint) joinLocksStartIdx;
    }
}
