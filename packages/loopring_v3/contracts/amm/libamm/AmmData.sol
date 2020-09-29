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
        address[] tokens;
        uint96[]  weights;
        uint8     feeBips;
        string    tokenSymbol;
    }

    struct PoolJoin
    {
        address  owner;
        uint     minPoolAmountOut;
        uint96[] maxAmountsIn;
        uint     validUntil;
        bool     joinFromLayer2;
        bool     mintToLayer2;
        uint96[] fees;
    }

    struct PoolExit
    {
        address  owner;
        uint     poolAmountIn;
        uint96[] minAmountsOut;
        uint     validUntil;
        bool     exitToLayer2;
        bool     burnFromLayer2;
    }

    // A transfer of the pool token from the pool to a user on layer2
    struct PoolTokenTransfer
    {
        uint96  amount;
        address to;
    }

    struct LockRecord
    {
        bytes32  txHash;
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
        uint32   accountID;
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
        bytes32     domainSeparator;
        uint        shutdownTimestamp;
        uint8       feeBips;
        Token[]     tokens;

        // Pool tokens to be burned from this address.
        uint        poolAmountToBurn;

        mapping (address => User) userMap;

        // A map of approved transaction hashes to the timestamp it was created
        mapping (bytes32 => uint) approvedTx;
        mapping (bytes32 => bool) consumedTx;

        // A map from an address to a nonce.
        mapping(address => uint) nonces;
    }
}
