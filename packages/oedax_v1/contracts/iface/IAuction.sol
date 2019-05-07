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

    /// @dev Join the auction by placing a BID.
    /// @param amount The amount of bidToken.
    /// @return accepted The amount of token accepted by the auction.
    function bid(uint amount)
        external
        returns (
            uint accepted
        );

    /// @dev Join the auction by placing an ASK.
    /// @param amount The amount of askToken.
    /// @return accepted The amount of token accepted by the auction.
    function ask(uint amount)
        external
        returns (
            uint accepted
        );

    /// @dev Settles the auction.
    /// After the auction ends, everyone can settle the auction by calling this method.
    /// If the price is not bounded by curves, 50% of Ether stake will be charged by the
    /// protocol as fee, the rest will be used as a rebate.
    /// If the settlement happens inside of the settleGracePeriod window, all rebate will be
    /// sent back to the owner, otherwise, the 50% of the rebate will be sent to the settler,
    /// the rest will be charged as fees.
    function settle()
        public;

    function withdraw()
        external;

    function withdrawFor(
        address payable[] calldata users
        )
        external;

    /// @dev Calculate the auction's status on the fly.
    /// @return isBounded If the auction's actual price has already been bounded by the
    ///         bid and ask curves.
    /// @return timeRemaining The time (in seconds) remained for the auction to end.
    /// @return actualPrice The actual price. If the auction has been settled, this value is 0.
    /// @return askPrice The current ask price.
    /// @return bidPrice The current bid price.
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
