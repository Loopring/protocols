pragma solidity ^0.5.11;

contract Claimable
{
    function claimOwnership() public;
}

contract GhostOwner {
    address payable public creator;
    address public constant LONG_TERM = 0xC8Fcc48D1454a83589169294470549A2e1713DeC;

    constructor() public {
        creator = msg.sender;
    }

    function claimAndDestruct() external {
        Claimable(LONG_TERM).claimOwnership();
        selfdestruct(creator);
    }
}