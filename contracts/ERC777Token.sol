pragma solidity 0.4.24;

interface ERC777Token {
    function name() external view returns (string);
    function symbol() external view returns (string);
    function totalSupply() external view returns (uint256);
    function balanceOf(address owner) public view returns (uint256);
    function granularity() external view returns (uint256);

    function defaultOperators() external view returns (address[]);
    function isOperatorFor(address operator, address tokenHolder) public view returns (bool);
    function authorizeOperator(address operator) external;
    function revokeOperator(address operator) external;

    function send(address to, uint256 amount, bytes holderData) external;
    function operatorSend(address from, address to, uint256 amount, bytes holderData, bytes operatorData) external;

    function burn(uint256 amount, bytes holderData) external;
    function operatorBurn(address from, uint256 amount, bytes holderData, bytes operatorData) external;

    event Sent(
        address indexed operator,
        address indexed from,
        address indexed to,
        uint256 amount,
        bytes holderData,
        bytes operatorData
    ); // solhint-disable-next-line separate-by-one-line-in-contract
    event Minted(address indexed operator, address indexed to, uint256 amount, bytes operatorData);
    event Burned(address indexed operator, address indexed from, uint256 amount, bytes holderData, bytes operatorData);
    event AuthorizedOperator(address indexed operator, address indexed tokenHolder);
    event RevokedOperator(address indexed operator, address indexed tokenHolder);
}
