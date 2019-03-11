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
        returns (bool);

    function withdraw(
        address user,
        address token,
        uint    amount)
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
