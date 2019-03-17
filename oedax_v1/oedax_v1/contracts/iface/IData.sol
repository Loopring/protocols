pragma solidity 0.5.5;
pragma experimental ABIEncoderV2;

import "./ICurve.sol";

contract IData {
    struct AuctionState {
        // The following are state information that changes while the auction is still active.
        uint    askPrice;           // The current ask/sell price curve value
        uint    bidPrice;           // The current bid/buy price curve value
        uint    asks;               // the total asks or tokenA
        uint    bids;               // The total bids or tokenB
        uint    estimatedTTLSeconds;// Estimated time in seconds that this auction will end.

        // The actual price should be cauclated using tokenB as the quote token.
        // actualPrice = (asks / pow(10, decimalsA) ) / (bids/ pow(10, decimalsB) )
        // If bids == 0, returns -1(?) in indicate infinite or undefined.

        // Waiting list. Note at most one of the following can be non-zero.
        uint    asksWaiting;        // The total amount of asks in the waiting list.
        uint    bidsWaiting;        // the total amount of bids in the waiting list.

        // Deposit & Withdrawal limits. Withdrawal limit should be 0 if withdrawal is disabled;
        // deposit limit should put waiting list in consideration.
        uint    asksDepositLimit;
        uint    bidsDepositLimit;
        uint    asksWithdrawalLimit;
        uint    bidsWithdrawalLimit;

        // selected curve
        address curve;
    }

    struct AuctionInfo {
        // The following are constant setups that never change.
        int64   id;                 // 0-based ever increasing id
        uint    startedTimestamp;   // Timestamp when this auction is started.
        uint    delaySeconds;       // The delay for open participation.
        address creator;            // The one crated this auction.
        address tokenA;             // The ask (sell) token
        address tokenB;             // The bid (buy) token
        uint    decimalsA;          // Decimals of tokenA, should be read from their smart contract,
                                    // not supplied manually.
        uint    decimalsB;          // Decimals of tokenB, should be read from their smart contract,
                                    // not supplied manually.
        uint    priceScale;         // A scaling factor to convert prices to double values,
                                    // including targetPrice, askPrice, bidPrice.
        uint    targetPrice;        // `targetPrice/priceScale` is the 'P' parameter in the
                                    // whitepapaer
        uint    scaleFactor;        // The 'M' parameter in the whitepapaer
        uint    durationSeconds;    // The 'T' parameter in the whitepapaer

        bool    isWithdrawalAllowed;
        bool    isTakerFeeDisabled;

        uint    maxAmountAPerAddr;
        uint    maxAmountBPerAddr;

        AuctionState state;
    }

}
