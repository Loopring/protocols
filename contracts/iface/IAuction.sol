pragma solidity 0.5.5;
pragma experimental ABIEncoderV2;


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

    function deposit(
        address user,
        address token,
        uint    amount)
        public
        returns (bool successful);

    function withdraw(
        address user,
        address token,
        uint    amount)
        public
        returns (bool successful);

    function simulatePariticipation(
        address user,
        address token,
        int    amount) // allow amount < 0 for withdrawal
        public
        returns (bool successful, AcctionState memory state);

    // Try to settle the auction.
    function settle()
        external
        returns (bool successful);

    // Start a new aucton with the same parameters except the P and the delaySeconds parameter.
    // The new P parameter would be the settlement price of this auction.
    function clone(
        uint delaySeconds,
        uint initialAmountA, // The initial amount of tokenA from the initiator's account.
        uint initialAmountB) // The initial amount of tokenB from the initiator's account.
        external
        returns (address auction, uint id);

    function getAuctionInfo()
        view
        external
        returns (AuctionInfo memory);

    // If this function is too hard/costy to do, we can remove it.
    function getParticipations(
        uint skip,
        uint count
    )
        view
        external
        returns (Participation[] memory participations, uint total);

    // If this function is too hard/costy to do, we can remove it.
    function getParticipants(
        uint skip,
        uint count
    )
        view
        external
        returns (Participant[] memory participants, unit total);
}
