#ifndef _CONSTANTS_H_
#define _CONSTANTS_H_

namespace Loopring
{
    static const unsigned int TREE_DEPTH_TRADING_HISTORY = 16;
    static const unsigned int TREE_DEPTH_ACCOUNTS = 24;
    static const unsigned int TREE_DEPTH_TOKENS = 16;
    static const unsigned int TREE_DEPTH_BALANCES = 12;

    static const unsigned int NUM_BITS_TOKENID = 12;
    static const unsigned int NUM_BITS_WALLETID = 12;
    static const unsigned int NUM_BITS_MINERID = 12;

    static const unsigned int MAX_NUM_WALLETS = 1024;

    static const unsigned int TOKENID_ETH = 0;
    static const unsigned int TOKENID_LRC = 1;
}

#endif