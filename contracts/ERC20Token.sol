pragma solidity ^0.4.24;

interface ERC20Token {
    function name() public constant returns (string);
    function symbol() public constant returns (string);
    function decimals() public constant returns (uint8);
    function totalSupply() public constant returns (uint256);
    function balanceOf(address owner) public constant returns (uint256);
    function transfer(address to, uint256 amount) public returns (bool);
    function transferFrom(address from, address to, uint256 amount) public returns (bool);
    function approve(address spender, uint256 amount) public returns (bool);
    function allowance(address owner, address spender) public constant returns (uint256);

    // solhint-disable-next-line no-simple-event-func-name
    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);
}
