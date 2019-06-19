/*

  Copyright 2017 Loopring Project Ltd (Loopring Foundation).

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/
pragma solidity 0.5.7;


/// @title IAuctioner
/// @dev IAuctioner provides an interface to start an auction for auctioning off
///      certain amount of ERC20 token for another ERC20 token or Ether.
/// @author Daniel Wang - <daniel@loopring.org>
contract IAuctioner
{
    event AuctionStarted(
        address tokenS,
        address tokenB,
        uint    amountS,
        uint    expectedAmountB,
        uint    duration,
        address auction
    );

    /// @dev Start a new Auction
    /// @param tokenS Token to sell. Use `0x0` for Ether.
    /// @param tokenB Token to buy. Use `0x0` for Ether.
    /// @param amountS Amount of tokenS
    /// @param expectedAmountB The expected amount of tokenB to receive. 
    ///        This value, together with amountS, will be used to set up
    ///        the expected auction price.
    /// @param duration The expected auction duration in seconds
    /// @return auction The auction's address
    function startAuction(
        address tokenS,
        address tokenB,
        uint    amountS,
        uint    expectedAmountB,
        uint    duration
        )
        external
        payable
        returns (
            address auction
        );
}
