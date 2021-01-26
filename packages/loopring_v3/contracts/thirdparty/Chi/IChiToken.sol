// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.7.0;


interface IChiToken
{
    function free(uint256 value)
    external
    returns (uint256);

    function freeUpTo(uint256 value)
    external
    returns (uint256);

    function freeFrom(address from, uint256 value)
    external
    returns (uint256);

    function freeFromUpTo(address from, uint256 value)
    external
    returns (uint256 freed);
}