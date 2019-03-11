pragma solidity 0.5.5;
pragma experimental ABIEncoderV2;

/**
 * All Auction contracts extend this interface.
 */
contract IAuction {

    enum Phase {
        ONE,
        TWO,
        THREE
    }

    struct AuctionInfo {
        address tokenS;
        address tokenB;
        uint initPrice;   // P
        uint scaleFactor; // M
        bool withdrawalAllowed;
    }

    struct Status {
        Phase p;
        uint priceS;
        uint priceB;
        bool isAlive;
    }

    struct BidRecord {
        uint index;
        address user;
        address token;
        int amount; // > 0: deposit, < 0: withdraw
        uint timestamp;
    }

    function start()
        external
        returns (bool);

    function bid(address user, address token, int amount)
        public
        returns (bool);

    function end()
        external
        returns (bool);

    function getInfo()
        view
        external
        returns (AuctionInfo memory);

    // current auction status
    function status()
        view
        external
        returns (Status memory);

    // calculate auction status if make some bid
    function statusAfterBid(
        address token,  // must be tokenS or tokenB
        int amount  // > 0, deposit, < 0, withdraw
    )
        view
        external
        returns (Status memory);

    function getBidHistory(
        uint skip,
        uint count
    )
        view
        external
        returns (BidRecord[] memory);

}
