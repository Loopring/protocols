// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../core/iface/ExchangeData.sol";
import "../../core/iface/IExchangeV3.sol";


/// @title AmmData
library AmmData
{
    function POOL_TOKEN_BASE() internal pure returns (uint) { return 10 ** 18; }
    function POOL_TOKEN_INITIAL_SUPPLY() internal pure returns (uint) { return 100 * POOL_TOKEN_BASE(); }
    function MAX_FORCED_EXIT_AGE() internal pure returns (uint) { return 7 days; }
    function MAX_FORCED_EXIT_COUNT() internal pure returns (uint) { return 100; }

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
    }

    struct PoolJoin
    {
        address   owner;
        uint96[]  joinAmounts;
        uint96[]  joinFees;
        uint32[]  joinStorageIDs;
        uint96    mintMinAmount;
        uint64    validUntil;
    }

    struct PoolExit
    {
        address   owner;
        uint96    burnAmount;
        uint32    burnStorageID; // for pool token withdrawal from user to the pool
        uint96[]  exitMinAmounts;
        uint64    validUntil;
    }

    struct PoolTx
    {
        PoolTxType txType;
        bytes      data;
        bytes      signature;
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

        // AMM pool state variables
        bytes32 domainSeparator;
        uint32  accountID;
        uint16  poolTokenID;

        Token[] tokens;

        uint    poolTokenBase;
        uint    poolTokenInitialSupply;
        uint    size; // == token.length;

        uint96[] balancesL2;
        uint     totalMintedSupply;
        uint96   poolBalanceL2;
    }

    struct State {
        // Pool token state variables
        string poolName;
        string symbol;
        uint   totalMintedSupply;
        uint96 poolBalanceL2;

        mapping(address => uint) balanceOf;
        mapping(address => mapping(address => uint)) allowance;
        mapping(address => uint) nonces;

        // AMM pool state variables
        IExchangeV3 exchange;
        uint32      accountID;
        bytes32     domainSeparator;
        uint        shutdownTimestamp;
        uint8       feeBips;
        uint16      forcedExitCount;
        Token[]     tokens;
        uint16      poolTokenID;

        // A map of approved transaction hashes to the timestamp it was created
        mapping (bytes32 => PoolExit) forcedExit;

        // A map from a user to the hash of the forced exit.
        mapping (address => bytes32) isExiting;
    }
}
