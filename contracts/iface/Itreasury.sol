pragma solidity 0.5.5;
pragma experimental ABIEncoderV2;


contract ITreasury {

    // user => (token => amount)
    mapping (address => mapping (address => uint)) userTotalBalances;

    // user => (token => amount)
    mapping (address => mapping (address => uint)) userAvailableBalances;

    // user => (auction_id => （token => amount))
    mapping (address => mapping (uint => mapping (address => uint))) userLockedBalances;


    mapping (uint => address) auctionIdMap;
    mapping (address => unit) auctionAddressMap;

    function deposit(
        address user,
        address token,
        uint    amount  // must be greater than 0.
    )
    external
    returns (bool);

    function withdraw(
        address user,
        address token,
        uint    amount  // specify 0 to withdrawl as much as possible.
    )
    external
    returns (bool);

    function getBalance(
        address user,
        address token
    )
        view
        external
        returns (uint total, uint available, uint locked);

    function registerAuction(
        address auction,
        uint    id
    )
        external
        returns (bool successful);


    // In case of an high-risk bug, the admin can return all tokens, including those locked in
    // active auctions, to their original owners.
    // If this function is called, all invocation from any on-going auctions will fail, but all
    // users' asset will be safe.
    // This method can only be called once.
    function terminate() external;

    function isTerminated() external returns (bool terminated);
}
