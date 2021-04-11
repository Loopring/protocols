// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

struct BridgeTransfer
{
    address owner;
    address token;
    uint96  amount;
}

struct InternalBridgeTransfer
{
    address owner;
    uint16  tokenID;
    uint96  amount;
}

struct TokenData
{
    address token;
    uint16  tokenID;
    uint    amount;
}

struct BridgeCall
{
    address owner;
    address token;
    uint96  amount;
    bytes   userData;
    uint    minGas;
    uint    maxFee;
    uint    validUntil;
}

struct ConnectorGroup
{
    bytes               groupData;
    BridgeCall[]        calls;
}

struct ConnectorCalls
{
    address             connector;
    uint                gasLimit;
    ConnectorGroup[]    groups;
}

struct TransferBatch
{
    uint     batchID;
    uint96[] amounts;
}

struct BridgeOperations
{
    TransferBatch[]  transferBatches;
    ConnectorCalls[] connectorCalls;
    TokenData[]      tokens;
}