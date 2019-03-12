pragma solidity 0.5.5;
pragma experimental ABIEncoderV2;

import "./IData.sol";


contract IOedax is IData {
    // Two possible paths:
    // 1):STARTED -> CONSTRAINED -> CLOSED
    // 2):STARTED -> CONSTRAINED -> CLOSED -> SETTLED
    // 3):SCHEDULED -> STARTED -> CONSTRAINED -> CLOSED
    // 4):SCHEDULED -> STARTED -> CONSTRAINED -> CLOSED -> SETTLED
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
        uint    initialAmountA,         // The initial amount of tokenA from the creator's account.
        uint    initialAmountB,         // The initial amount of tokenB from the creator's account.
        uint    maxAmountAPerAddr,      // The max amount of tokenA per address, 0 for unlimited.
        uint    maxAmountBPerAddr,      // The max amount of tokenB per address, 0 for unlimited.
        bool    isTakerFeeDisabled      // Disable using takerBips
    )
        external
        returns (
            address auction,
            uint    id
        );

    function getAuctionInfo(uint id)
        external
        view
        returns (
            AuctionInfo memory info
        );

    function getAuctions(
        uint    skip,
        uint    count,
        address creator,
        Status  status
    )
        external
        view
        returns (
            uint[] memory auctions
        );

    // All fee settings will only apply to future auctions, but not exxisting auctions.
    // One basis point is equivalent to 0.01%.
    // We suggest the followign values:
    // creationFeeEth           = 0 ETH
    // protocolBips             = 5   (0.05%)
    // walletBips               = 5   (0.05%)
    // takerBips                = 25  (0.25%)
    // withdrawalPenaltyBips    = 250 (2.50%)
    // The earliest maker will earn 25-5-5=15 bips (0.15%) rebate, the latest taker will pay
    // 25+5+5=35 bips (0.35) fee. All user combinedly pay 5+5=10 bips (0.1%) fee out of their
    // purchased tokens.

    function setFeeSettings(
        address recepient,
        uint    creationFeeEth,     // the required Ether fee from auction creators. We may need to
                                    // increase this if there are too many small auctions.
        uint    protocolBips,       // the fee paid to Oedax protocol
        uint    walletBipts,        // the fee paid to wallet or tools that help create the deposit
                                    // transactions, note that withdrawal doen't imply a fee.
        uint    takerBips,          // the max bips takers pays makers.
        uint    withdrawalPenaltyBips  // the percentage of withdrawal amount to pay the protocol.
                                       // Note that wallet and makers won't get part of the penalty.
    )
        external;

    function getFeeSettings(
    )
        external
        view
        returns (
            address recepient,
            uint    creationFeeEth,
            uint    protocolBips,
            uint    walletBipts,
            uint    takerBips,
            uint    withdrawalPenaltyBips
        );

}
