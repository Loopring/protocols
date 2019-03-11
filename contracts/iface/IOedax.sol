pragma solidity 0.5.5;
pragma experimental ABIEncoderV2;


contract IOedax {
    // Two possible paths:
    // 1):STARTED -> CONSTRAINED -> CLOSED
    // 2):STARTED -> CONSTRAINED -> SETTLED
    // 3):SCHEDULED -> STARTED -> CONSTRAINED -> CLOSED
    // 4):SCHEDULED -> STARTED -> CONSTRAINED -> SETTLED
    // It is also possible for the auction to jump right into the CONSTRAINED status from
    // STARTED.
    // When we say an auction is active or ongoing, it means the auction's status
    // is either STARTED or CONSTRAINED.
    enum Status {
        STARTED,        // Started but not ready for participation.
        OPEN,           // Started with actual price out of bid/ask curves
        CONSTRAINED,    // Actual price in between bid/ask curves
        CLOSED,         // Ended without settlement
        SETTLED         // Ended with settlement
    }

    struct AuctionState {
        // The following are state information that changes while the auction is still active.
        uint    askPrice;          // The current ask/sell price curve value
        uint    bidPrice;          // The current bid/buy price curve valuem
        uint    asks;              // the total asks or tokenA
        uint    bids;              // The total bids or tokenB
        uint    estimatedTTLSeconds; // Estimated time in seconds that this auction will end.

        // The actual price should be cauclated using tokenB as the quote token.
        // actualPrice = (asks / pow(10, decimalsA) ) / (bids/ pow(10, decimalsB) )
        // If bids == 0, returns -1(?) in indicate infinite or undefined.

        // Waiting list. Note at most one of the following can be non-zero.
        uint    asksWaiting;       // The total amount of asks in the waiting list.
        uint    bidsWaiting;       // the total amount of bids in the waiting list.

        // Deposit & Withdrawal limits. Withdrawal limit should be 0 if withdrawal is disabled;
        // deposit limit should put waiting list in consideration.
        uint   asksDepositLimit;
        uint   bidsDepositLimit;
        uint   asksWithdrawalLimit;
        uint   bidsWithdrawalLimit;
    }

    struct AuctionInfo {
        // The following are constant setups that never change.
        int64   id;                // 0-based ever increasing id
        uint    startedTimestamp;  // Timestamp when this auction is started.
        uint    delaySeconds;      // The delay for open participation.
        address initiator;         // The one crated this auction.
        address tokenA;            // The ask (sell) token
        address tokenB;            // The bid (buy) token
        uint    decimalsA;         // Decimals of tokenA, should be read from their smart contract, not supplied manually.
        uint    decimalsB;         // Decimals of tokenB, should be read from their smart contract, not supplied manually.
        uint    priceScale;        // A scaling factor to convert prices to double values, including targetPrice, askPrice, bidPrice.
        uint    targetPrice;       // `targetPrice/priceScale` is the 'P' parameter in the whitepapaer
        uint    scaleFactor;       // The 'M' parameter in the whitepapaer
        uint    durationSeconds;   // The 'T' parameter in the whitepapaer
        bool    isWithdrawalAllowed;

        AuctionState state;
    }

    // Initiate an auction
    function initAuction(
        uint    delaySeconds,
        address tokenA,
        address tokenB,
        uint    decimalsA,
        uint    decimalsB,
        uint    priceScale,
        uint    targetPrice,
        uint    scaleFactor,
        uint    durationSeconds,
        bool    isWithdrawalAllowed)
        external
        returns (address auction, uint id);

    function triggerSettlement(uint id)
        external
        returns (bool successful);

    function getAuctionInfo(uint id)
        view
        external
        returns (AuctionInfo memory info);

    function getAuctions(
        uint   skip,
        uint   count,
        string initiator,
        Status status
    )
        view
        external
        returns (Auctions[] memory auctions, unit total);
}
