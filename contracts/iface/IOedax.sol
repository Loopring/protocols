pragma solidity 0.5.5;
pragma experimental ABIEncoderV2;

import "./IData.sol";


contract IOedax is IData {
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

    // Initiate an auction
    function createAuction(
        uint    delaySeconds,
        address tokenA,
        address tokenB,
        uint    decimalsA,
        uint    decimalsB,
        uint    priceScale,
        uint    targetPrice,
        uint    scaleFactor,
        uint    durationSeconds,
        bool    isWithdrawalAllowed,
        uint    initialAmountA, // The initial amount of tokenA from the creator's account.
        uint    initialAmountB) // The initial amount of tokenB from the creator's account.
        external
        returns (address auction, uint id);

    function getAuctionInfo(uint id)
        view
        external
        returns (AuctionInfo memory info);

    function getAuctions(
        uint   skip,
        uint   count,
        address creator,
        Status status
    )
        view
        external
        returns (uint[] memory auctions);

    function setFeeSettings(
        address recepient,
        uint    bips  // One basis point is equivalent to 0.01%
    )
        external;

    function getFeeSettings(
    )
        view
        external
        returns (address recepient, uint bips);

}
