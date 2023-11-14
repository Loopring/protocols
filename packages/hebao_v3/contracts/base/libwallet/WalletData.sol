// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;
pragma experimental ABIEncoderV2;

enum SigRequirement {
    MAJORITY_OWNER_NOT_ALLOWED,
    MAJORITY_OWNER_ALLOWED,
    MAJORITY_OWNER_REQUIRED,
    OWNER_OR_ANY_GUARDIAN,
    ANY_GUARDIAN
}

struct Approval {
    address[] signers;
    bytes[] signatures;
    uint256 validUntil;
}

// Optimized to fit into 64 bytes (2 slots)
struct Quota {
    uint128 currentQuota;
    uint128 pendingQuota;
    uint128 spentAmount;
    uint64 spentTimestamp;
    uint64 pendingUntil;
}

enum GuardianStatus {
    REMOVE, // Being removed or removed after validUntil timestamp
    ADD // Being added or added after validSince timestamp.
}

// Optimized to fit into 32 bytes (1 slot)
struct Guardian {
    address addr;
    uint8 status;
    uint64 timestamp; // validSince if status = ADD; validUntil if adding = REMOVE;
}

struct Wallet {
    address owner;
    uint64 creationTimestamp;
    // relayer => nonce
    uint nonce;
    // hash => consumed
    mapping(bytes32 => bool) hashes;
    bool locked;
    Guardian[] guardians;
    mapping(address => uint) guardianIdx;
    address inheritor;
    uint32 inheritWaitingPeriod;
    uint64 lastActive; // the latest timestamp the owner is considered to be active
    Quota quota;
    // whitelisted address => effective timestamp
    mapping(address => uint) whitelisted;
    address entryPoint;
}
