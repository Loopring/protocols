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

import "../lib/Ownable.sol";

import "./IAuctionData.sol";

/// @title IAuction
/// @author Daniel Wang  - <daniel@loopring.org>
contract IAuction is Ownable
{
    // Emit once per user during auction settlement.
    event Trade(
        address user,
        int     askAmount,
        int     bidAmount
    );

    IAuctionData.State  state;

    /// @dev Join the auciton by placing a BID.
    /// @param amount The amount of bidToken.
    /// @return accepted The amount of token accepted by the auction.
    /// @return queued The amount of token not accepted by queued in the waiting list.
    function bid(uint amount)
        external
        returns (
            uint accepted,
            uint queued
        );

    /// @dev Join the auciton by placing an ASK.
    /// @param amount The amount of askToken.
    /// @return accepted The amount of token accepted by the auction.
    /// @return queued The amount of token not accepted by queued in the waiting list.
    function ask(uint amount)
        external
        returns (
            uint accepted,
            uint queued
        );

    /// @dev Settles the auction.
    /// After the auction ends and before `settleGracePeriod`, only the owner of the
    /// auction can call this method to trigger final token transfers. After `settleGracePeriod`
    /// anyone can also call this method to trigger the settlement and earn up to 50%
    /// of the Ether staked by the auction's owner.
    ///
    /// For the owner to get all its Ether stake, he/she needs to call this method before
    /// `settleGracePeriod/2`, otherwise he will gradually lose some Ether to the protocol.
    function settle()
        external;

    /// @dev Calculate the auciton's status on the fly.
    /// @return isBounded If the auction's actual price has already been bounded by the
    ///         bid and ask curves.
    /// @return timeRemaining The time (in seconds) remained for the auction to end.
    /// @return actualPrice The autual price. If the auction has been settled, this value is 0.
    /// @return askPrice The current ask price.
    /// @return bkdPrixce The current bid price.
    /// @return askAllowed The max amount of ask tokens that can be accepted.
    /// @return bidAllowed The max amount of bid tokens that can be accepted.
    function getStatus()
        external
        view
        returns (
            bool isBounded,
            uint timeRemaining,
            uint actualPrice,
            uint askPrice,
            uint bidPrice,
            uint askAllowed,
            uint bidAllowed
        );
}
