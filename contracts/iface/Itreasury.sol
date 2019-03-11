pragma solidity 0.5.5;

contract Itreasury {

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
        uint    amount
    )
    external
    returns (bool);

    function withdraw(
        address user,
        address token,
        uint    amount
    )
    external
    returns (bool);

    function getBalance(
        address user,
        address token
    )
        view
        external
        returns (uint totalBalance, uint avaialbeBalance, uint lockedBalance);

    function registerAuction(
        address auction,
        uint    id
    )
        external
        returns (bool successful);
}
