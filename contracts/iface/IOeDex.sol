pragma solidity 0.5.5;

contract IOeDex {

    // user => (token => amount)
    mapping (address => mapping (address => uint)) userBalances;

    // user => (auction => amount)
    mapping (address => mapping (address => uint)) userAuctionBidBalances;

    function deposit(
        address user,
        address token,
        uint amount
    )
    external
    returns (bool);

    // some token may frozen in Auctions.
    function withdraw(
        address user,
        address token,
        uint amount
    )
    external
    returns (bool);

    function getFrozenAmount(
        address user,
        address token
    )
        view
        external
        returns (uint);

    function balanceOf(
        address user,
        address token
    )
        view
        external
        returns (uint);

    function createAuction(
        address auctionContract
    )
        external
        returns (bool);

    function bidAuction(
        address auction,
        address token,
        int amount // > 0, deposit, < 0, withdraw
    )
        external
        returns (bool);

    function queryLiveAuctions(address user)
        view
        external
        returns (address[] memory);

}
