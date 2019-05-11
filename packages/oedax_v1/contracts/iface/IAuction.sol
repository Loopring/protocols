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

    event Bid(
        address user,
        uint    accepted,
        uint    time
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
    ///
    /// It may be necessary to call this function multiple times depending on how much gas
    /// is sent for this transaction and how many users need to have their tokens distributed.
    ///
    /// The following is done when settling an auction:
    ///     - All tokens are distributed to the users
    ///     - All fees are distributed to the fee recipients
    ///
    /// If the price is not bounded by the curves, 50% of the Ether stake will be charged
    /// by the protocol as fee.
    ///
    /// The auction owner is also responsible for distributing the tokens to the users in
    /// 'settleGracePeriodBase + numUsers * settleGracePeriodPerUser' seconds. If he fails
    /// to do so the auction owner wil lose his complete stake and all his trading fees.
    /// 75% of the stake will be charged by the protocol as fee and 25% of the Ether stake
    /// will be sent to the caller of this function when the fees are distributed (which is
    /// done after all tokens are distributed to the users). The caller of the function
    /// will also receive the owner's trading fees.
    function settle()
        public;

    /// @dev Withdraws the tokens for the caller. Can only be called when the auction has settled.
    ///      There should be no need for users to call this function because the tokens will be
    ///      automatically distributed by the auction owner. But this function can be used if that
    ///      doesn't happen or the users wants access to their tokens as soon as possible.
    function withdraw()
        external;

    /// @dev Withdraws the tokens for the specified users. Can only be called when the auction has settled.
    ///      There should be no need for users to call this function because the tokens will be
    ///      automatically distributed by the auction owner. But this function can be used if that
    ///      doesn't happen or the users wants access to their tokens as soon as possible.
    /// @param users The users to withdraw the tokens for.
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
