pragma solidity ^0.5.11;
pragma experimental ABIEncoderV2;

interface CToken {
    function comptroller() external view returns (address);
    function underlying() external view returns (address);
    function symbol() external view returns (string memory);
    function exchangeRateCurrent() external returns (uint);
    function exchangeRateStored() external view returns (uint);
    function balanceOf(address _account) external view returns (uint);
    function borrowBalanceCurrent(address _account) external returns (uint);
    function borrowBalanceStored(address _account) external view returns (uint);
}