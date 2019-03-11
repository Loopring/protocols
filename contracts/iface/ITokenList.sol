pragma solidity 0.5.5;

contract ITokenList {

    function getDefaultWhiteList()
        view
        external
        returns (address[] memory);

    function getTokenSymbol(address token)
        view
        external
        returns (string memory);

    function addCustomToken(
        address user,
        address token,
        string calldata symbol
    )
        external
        returns (bool);

    function getCustomWhiteList(address user)
        view
        external
        returns (address[] memory);
}
