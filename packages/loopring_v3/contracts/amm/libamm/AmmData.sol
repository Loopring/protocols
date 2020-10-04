// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../core/iface/ExchangeData.sol";
import "../../core/iface/IExchangeV3.sol";
import "./AmmSharedConfig.sol";


/// @title AmmData
library AmmData
{
    function POOL_TOKEN_BASE() internal pure returns (uint) { return 10 ** 10; }
    function POOL_TOKEN_MINTED_SUPPLY() internal pure returns (uint) { return uint96(-1); }

    enum PoolTxType
    {
        NOOP,
        JOIN,
        EXIT
    }

    struct PoolConfig
    {
        address   sharedConfig;
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
        uint32    validUntil;
    }

    struct PoolExit
    {
        address   owner;
        uint96    burnAmount;
        uint32    burnStorageID; // for pool token withdrawal from user to the pool
        uint96[]  exitMinAmounts;
        uint32    validUntil;
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
        uint    poolTokenBurnedSupply;

        uint     size; // == token.length;
        Token[]  tokens;
        uint96[] tokenBalancesL2;
    }

    struct State {
        // Pool token state variables
        string poolName;
        string symbol;
        uint poolTokenBurnedSupply;

        mapping(address => uint) balanceOf;
        mapping(address => mapping(address => uint)) allowance;
        mapping(address => uint) nonces;

        // AMM pool state variables
        AmmSharedConfig sharedConfig;

        IExchangeV3 exchange;
        uint32      accountID;
        uint16      poolTokenID;
        bytes32     domainSeparator;
        uint        shutdownTimestamp;
        uint8       feeBips;
        uint16      forcedExitCount;
        Token[]     tokens;

        // A map from a user to the forced exit.
        mapping (address => PoolExit) forcedExit;
    }
}
