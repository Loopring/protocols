pragma solidity 0.5.5;
pragma experimental ABIEncoderV2;

/**
 * All Auction contracts extend this interface.
 */


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

    struct AcctionState {
        // The following are state information that changes while the auction is still active.
        uint    askPrice;          // The current ask/sell price curve value
        uint    bidPrice;          // The current bid/buy price curve valuem
        uint    asks;              // the total asks or tokenA
        uint    bids;              // The total bids or tokenB
        uint    estimatedTTLSeconds; // Estimated time in seconds that this auction will end.

        // The actual price should be cauclated using tokenB as the quote token.
        // actualPrice = (asks / pow(10, decimalsA) ) / (bids/ pow(10, decimalsB) )
        // If bids == 0, returns -1(?) in indicate infinite or undefined.

        uint    asksWaiting;       // The total amount of asks in the waiting list.
        uint    bidsWaiting;       // the total amount of bids in the waiting list.
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

    // Start a auction
    function start(
        unit delaySeconds,
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
        uint skip,
        uint count,
        string initiator,
    )
        view
        external
        returns (Participant[] memory participants, unit total);
}

contract IAuction {
    struct Participation {
        uint    index;             // start from 0
        address user;
        address token;
        int     amount;            // >= 0: deposit, < 0: withdraw
        uint    timestamp;
    }

    struct Participant {
        address  user;
        uint     amountA;
        uint     numParticipationsA;
        int      avgFeePointsA;    // < 0 means rebate.
        uint     amountB;
        uint     numParticipationsB;
        int      avgFeePointsB;    // < 0 means rebate.
    }

    function participate(
        address user,
        address token,
        int    amount) // allow amount < 0 for withdrawal
        public
        returns (bool);

    function simulatePariticipation(
        address user,
        address token,
        int    amount) // allow amount < 0 for withdrawal
        public
        returns (bool successful, AcctionState memory state);

    function triggerSettlement()
        external
        returns (bool);

    function getAuctionInfo()
        view
        external
        returns (AuctionInfo memory);

    function getParticipations(
        uint skip,
        uint count
    )
        view
        external
        returns (Participation[] memory participations, uint total);

    function getParticipants(
        uint skip,
        uint count
    )
        view
        external
        returns (Participant[] memory participants, unit total);
}
