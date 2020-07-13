// SPDX-License-Identifier: UNLICENSED
// From Compound code base - https://github.com/compound-finance/compound-protocol/blob/master/contracts/CToken.sol
// with minor modificaiton.
pragma solidity ^0.6.10;
pragma experimental ABIEncoderV2;

interface CToken {
    function comptroller() external view returns (address);
    function underlying() external view returns (address);
    function symbol() external view returns (string memory);
    function supplyRatePerBlock() external view returns (uint);
    function borrowRatePerBlock() external view returns (uint);
    function exchangeRateCurrent() external returns (uint);
    function exchangeRateStored() external view returns (uint);
    function balanceOf(address _account) external view returns (uint);
    function borrowBalanceCurrent(address _account) external returns (uint);
    function borrowBalanceStored(address _account) external view returns (uint);
}