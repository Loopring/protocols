#ifndef _CONSTANTS_H_
#define _CONSTANTS_H_

namespace Loopring
{
    static const unsigned int TREE_DEPTH_TRADING_HISTORY = 14;
    static const unsigned int TREE_DEPTH_ACCOUNTS = 20;
    static const unsigned int TREE_DEPTH_TOKENS = 8;

    static const unsigned int NUM_BITS_AMOUNT = 96;
    static const unsigned int NUM_BITS_ACCOUNT = TREE_DEPTH_ACCOUNTS;
    static const unsigned int NUM_BITS_TOKEN = TREE_DEPTH_TOKENS;
    static const unsigned int NUM_BITS_ORDERID = 32;
    static const unsigned int NUM_BITS_TIMESTAMP = 32;
    static const unsigned int NUM_BITS_NONCE = 32;
    static const unsigned int NUM_BITS_PERCENTAGE = 7;

    static const char* EMPTY_TRADE_HISTORY = "188097087402145139130644985590333847214863843126209099263932665475118736309";
}

#endif