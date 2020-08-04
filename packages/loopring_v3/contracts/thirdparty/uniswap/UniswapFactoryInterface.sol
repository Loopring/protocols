// SPDX-License-Identifier: UNLICENSED
// Solidity Interface
pragma solidity ^0.7.0;

abstract contract UniswapFactoryInterface {
    // Public Variables
    address public exchangeTemplate;
    uint256 public tokenCount;
    // Create Exchange
    function createExchange(address token) external virtual returns (address exchange);
    // Get Exchange and Token Info
    function getExchange(address token) external view virtual returns (address exchange);
    function getToken(address exchange) external view virtual returns (address token);
    function getTokenWithId(uint256 tokenId) external view virtual returns (address token);
    // Never use
    function initializeFactory(address template) external virtual;
}