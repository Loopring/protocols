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

import "../../iface/IAuctionData.sol";

import "../../lib/MathUint.sol";

import "./AuctionAccount.sol";
import "./AuctionSettlement.sol";
import "./AuctionStatus.sol";

/// @title AuctionAsks
/// @author Daniel Wang  - <daniel@loopring.org>
library AuctionAsks
{
    using MathUint          for uint;
    using AuctionStatus     for IAuctionData.State;
    using AuctionAccount    for IAuctionData.State;

    event Ask(
        address user,
        uint    accepted,
        uint    time
    );

    function ask(
        IAuctionData.State storage s,
        uint amount
        )
        internal
        returns (uint accepted)
    {
        require(amount > 0, "zero amount");
        require(amount >= s.minAskAmount, "ask amount too small");

        IAuctionData.Status memory i = s.getAuctionStatus();
        require(s.isAuctionOpen(i), "auction needs to be open");
        require(i.askAllowed > 0, "not allowed");

        if (amount > i.askAllowed) {
            accepted = i.askAllowed;
            AuctionSettlement.payToken(msg.sender, s.askToken, amount - i.askAllowed);
        } else {
            accepted = amount;
        }

        if (s.oedax.logParticipant(msg.sender)) {
            s.users.push(msg.sender);
        }

        // Update the book keeping
        IAuctionData.Account storage a = s.accounts[msg.sender];

        uint elapsed = block.timestamp - s.startTime;

        a.askAmount = a.askAmount.add(accepted);
        uint extraRebateWeight = accepted.mul(s.T.sub(elapsed));
        a.askRebateWeight = a.askRebateWeight.add(extraRebateWeight);
        s.totalAskRebateWeight = s.totalAskRebateWeight.add(extraRebateWeight);

        s.askAmount = s.askAmount.add(accepted);

        if (s.bidShift != i.newBidShift) {
            s.bidShift = i.newBidShift;
            s.bidShifts.push(elapsed);
            s.bidShifts.push(s.bidShift);
        }

        if (s.askShift != i.newAskShift) {
            s.askShift = i.newAskShift;
            s.askShifts.push(elapsed);
            s.askShifts.push(s.askShift);
        }

        emit Ask(
            msg.sender,
            accepted,
            block.timestamp
        );
    }
}