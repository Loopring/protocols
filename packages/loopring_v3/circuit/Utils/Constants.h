#ifndef _CONSTANTS_H_
#define _CONSTANTS_H_

namespace Loopring
{
    static const unsigned int TREE_DEPTH_TRADING_HISTORY = 16;
    static const unsigned int TREE_DEPTH_ACCOUNTS = 24;
    static const unsigned int TREE_DEPTH_TOKENS = 12;

    static const unsigned int NUM_BITS_AMOUNT = 96;
    static const unsigned int NUM_BITS_ACCOUNT = TREE_DEPTH_ACCOUNTS;
    static const unsigned int NUM_BITS_TOKEN = TREE_DEPTH_TOKENS;
    static const unsigned int NUM_BITS_ORDERID = 32;
    static const unsigned int NUM_BITS_TIMESTAMP = 32;
    static const unsigned int NUM_BITS_NONCE = 32;
    static const unsigned int NUM_BITS_PERCENTAGE = 7;

    static const char* EMPTY_TRADE_HISTORY = "20873493930479413702173406318080544943433811476627345625793184813275733379280";
}

#endif