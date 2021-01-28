// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.7.0;

import "../../lib/ERC20.sol";


abstract contract IChiToken is ERC20
{
    function free(uint256 value)
    external
    virtual
    returns (uint256);

    function freeUpTo(uint256 value)
    external
    virtual
    returns (uint256);

    function freeFrom(address from, uint256 value)
    external
    virtual
    returns (uint256);

    function freeFromUpTo(address from, uint256 value)
    external
    virtual
    returns (uint256 freed);
}