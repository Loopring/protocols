// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;


/// @title ITokenSeller
/// @dev Use this contract to sell tokenS for as many tokenB.
/// @author Daniel Wang  - <daniel@loopring.org>
interface ITokenSeller
{
    /// @dev Sells all tokenS for tokenB
    /// @param tokenS The token or Ether (0x0) to sell.
    /// @param tokenB The token to buy.
    /// @return success True if success, false otherwise.
    function sellToken(
        address tokenS,
        address tokenB
        )
        external
        payable
        returns (bool success);
}