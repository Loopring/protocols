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
    function LOCK_DELAY() internal pure returns (uint) { return 1 days; }

    enum PoolTransactionType
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
        uint16    poolTokenID;
        address[] tokens;
        uint96[]  weights;
        uint8     feeBips;
        string    tokenSymbol;
    }

    struct PoolJoin
    {
        address  owner;
        bool     fromLayer2;
        uint     minPoolAmountOut;
        uint96[] maxAmountsIn;
        uint96[] fees;
        uint32[] storageIDs;
        uint     validUntil;
    }

    struct PoolExit
    {
        address  owner;
        bool     toLayer2;
        uint     poolAmountIn;
        uint96[] minAmountsOut;
        uint32[] storageIDs;
        uint     validUntil;
    }

    struct PoolJoin2
    {
        address  owner;
        uint     minPoolAmountOut;
        uint96[] maxAmountsIn;
        uint     validUntil;
        uint96[] fees;
    }

    struct PoolExit2
    {
        address  owner;
        uint     poolAmountIn;
        uint96[] minAmountsOut;
        uint     validUntil;
        bool     toLayer2;
    }

    struct LockRecord
    {
        bytes32  hash;
        uint96[] amounts; // the size should be either 1 or tokens.length
        uint     validUntil;
    }

    struct User
    {
        uint startIndex;
        LockRecord[] lockRecords;
        mapping (address => uint) withdrawable;
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
        uint96[] ammActualL2Balances;
        uint96[] ammExpectedL2Balances;
        uint     numTransactionsConsumed;

        Token[]  tokens;
        uint     size; // == token.length;

        uint     poolTokenBase;
        uint     poolTokenInitialSupply;
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
        uint16      poolTokenID;
        bytes32     domainSeparator;
        uint        shutdownTimestamp;
        uint8       feeBips;
        Token[]     tokens;

        mapping (address => User) UserMap;

        // A map of approved transaction hashes to the timestamp it was created
        mapping (bytes32 => uint) approvedTx;

        // A map from an owner to a token to the balance
        mapping (address => mapping (address => uint)) userBalance;

        // A map from an owner to the timestamp from which all funds of the user funds will be locked
        mapping (address => uint) lockedSince;
        // A map from an owner to the timestamp until all funds of the user are locked
        // A zero value == locked indefinitely.
        mapping (address => uint) lockedUntil;

        // A map from a token to the total balance owned directly by LPs (so NOT owned by the pool itself)
        mapping (address => uint) totalUserBalance;

        // A map from an address to a nonce.
        mapping(address => uint) nonces;

        // A map from an owner to if a user is currently exiting using an onchain approval.
        mapping (address => bool) isExiting;
    }
}
