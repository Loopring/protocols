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

    enum PoolTransactionType
    {
        NOOP,
        JOIN,
        EXIT
    }

    enum Direction
    {
        L1_TO_L1,
        L2_TO_L2,
        L1_TO_L2,
        L2_TO_L1
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
    }

    struct PoolJoin
    {
        address   owner;
        Direction direction;
        uint96[]  joinAmounts;
        uint96[]  joinFees;
        uint32    joinStorageID; // for tokens[1]'s' transfer from user to the pool
        uint96    mintMinAmount;
        uint      validUntil;
        uint32    nonce; // for onchain approved join requests
    }

    struct PoolExit
    {
        address   owner;
        Direction direction;
        uint96    burnAmount;
        uint32    burnStorageID; // for pool token withdrawal from user to the pool
        uint96[]  exitMinAmounts;
        uint      validUntil;
    }

    struct TokenLock
    {
        uint96[] amounts; // the size should be either 1 or tokens.length - 1
    }

    struct PoolTransaction
    {
        PoolTransactionType txType;
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
        ExchangeData.Block _block;
        IExchangeV3        exchange;
        address            exchangeDepositContract;

        uint     txIdx;
        bytes32  domainSeparator;
        bytes32  exchangeDomainSeparator;
        uint32   accountID;
        uint96[] ammActualL2Balances;
        uint96[] ammExpectedL2Balances;
        uint     numTransactionsConsumed;

        Token[]  tokens;
        uint     size; // == token.length;

        uint     poolTokenBase;
        uint     poolTokenInitialSupply;
        uint     totalSupply;
    }

    struct State {
        // Pool token state variables
        string poolName;
        string symbol;
        uint   totalSupply;


        mapping(address => uint) balanceOf;
        mapping(address => mapping(address => uint)) allowance;

        // AMM pool state variables
        IExchangeV3 exchange;
        uint32      accountID;
        bytes32     domainSeparator;
        uint        shutdownTimestamp;
        uint8       feeBips;
        Token[]     tokens;

        uint        poolTokenToBurn;

        mapping (address => uint) exitLockIdx;
        TokenLock[] exitLocks;
        uint         exitLocksIndex;

        mapping (address => TokenLock[]) joinLocks;
        mapping (address => uint) joinLockIdx;

        mapping (address => mapping (address => uint96)) balance;

        // A map of approved transaction hashes to the timestamp it was created
        mapping (bytes32 => uint) approvedTx;

        // A map from an address to a nonce.
        mapping(address => uint) nonces;
    }
}
