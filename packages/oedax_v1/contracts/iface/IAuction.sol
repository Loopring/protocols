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
    /// If the settlement happens outside of the settleGracePeriod window another
    /// 50% of the Ether stake will be charged by the protocol as fee.
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

    /// @dev Distributes the tokens to the users. Can only be called when the auction has settled.
    ///      The auction owner is responsible for distributing the tokens to the users in
    ///      distributeGracePeriodBase + numUsers * distributeGracePeriodPerUser seconds. If he fails
    ///      to do so 100% of the Ether stake will be charged by the protocol and
    ///      he loses all his trading fees.
    function distributeTokens()
        external;

    /// @dev Withdraws the Ether stake and owner trading fees. Can only be called when all tokens are distributed.
    ///      Normally the Ether stake and the trading fees are sent to the owner,
    ///      but when the tokens were distributed too late the owner loses his complete stake
    ///      and his trading fees go to the caller of this function.
    function withdrawOwnerStakeAndFees()
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
