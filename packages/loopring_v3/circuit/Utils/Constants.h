// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
#ifndef _CONSTANTS_H_
#define _CONSTANTS_H_

namespace Loopring
{
static const unsigned int TREE_DEPTH_STORAGE = 7;
static const unsigned int TREE_DEPTH_ACCOUNTS = 16;
static const unsigned int TREE_DEPTH_TOKENS = 8;

static const unsigned int TX_DATA_AVAILABILITY_SIZE = 68;

static const unsigned int NUM_BITS_MAX_VALUE = 254;
static const unsigned int NUM_BITS_FIELD_CAPACITY = 253;
static const unsigned int NUM_BITS_AMOUNT = 96;
static const unsigned int NUM_BITS_STORAGE_ADDRESS = TREE_DEPTH_STORAGE * 2;
static const unsigned int NUM_BITS_ACCOUNT = TREE_DEPTH_ACCOUNTS * 2;
static const unsigned int NUM_BITS_TOKEN = TREE_DEPTH_TOKENS * 2;
static const unsigned int NUM_BITS_STORAGEID = 32;
static const unsigned int NUM_BITS_TIMESTAMP = 32;
static const unsigned int NUM_BITS_NONCE = 32;
static const unsigned int NUM_BITS_BIPS = 12; // ceil(log2(2**NUM_BITS_BIPS_DA * FEE_MULTIPLIER))
static const unsigned int NUM_BITS_BIPS_DA = 6;
static const unsigned int NUM_BITS_PROTOCOL_FEE_BIPS = 8;
static const unsigned int NUM_BITS_TYPE = 8;
static const unsigned int NUM_STORAGE_SLOTS = 16384; // 2**NUM_BITS_STORAGE_ADDRESS
static const unsigned int NUM_MARKETS_PER_BLOCK = 16;
static const unsigned int NUM_BITS_TX_TYPE = 8;
static const unsigned int NUM_BITS_ADDRESS = 160;
static const unsigned int NUM_BITS_HASH = 160;
static const unsigned int NUM_BITS_AMM_BIPS = 8;

static const char *EMPTY_TRADE_HISTORY = "65927491675782344981534105642433692294864120547424810690492392975145903570"
                                         "90";
static const char *MAX_AMOUNT = "79228162514264337593543950335"; // 2^96 - 1
static const char *FIXED_BASE = "1000000000000000000";           // 10^18
static const unsigned int NUM_BITS_FIXED_BASE = 60;              // ceil(log2(10^18))
static const unsigned int FEE_MULTIPLIER = 50;

struct FloatEncoding
{
    unsigned int numBitsExponent;
    unsigned int numBitsMantissa;
    unsigned int exponentBase;
};
static const FloatEncoding Float24Encoding = {5, 19, 10};
static const FloatEncoding Float16Encoding = {5, 11, 10};

struct Accuracy
{
    unsigned int numerator;
    unsigned int denominator;
};
static const Accuracy Float24Accuracy = {100000 - 2, 100000};
static const Accuracy Float16Accuracy = {1000 - 5, 1000};
} // namespace Loopring

#endif