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
pragma experimental ABIEncoderV2;

import "../../iface/IAuctionData.sol";

import "../../lib/MathUint.sol";

import "./AuctionStatus.sol";
import "./AuctionAccount.sol";
import "./AuctionQueue.sol";

/// @title AuctionAsks.
/// @author Daniel Wang  - <daniel@loopring.org>
library AuctionBids
{
    using MathUint          for uint;
    using AuctionStatus     for IAuctionData.State;
    using AuctionAccount    for IAuctionData.State;
    using AuctionQueue      for IAuctionData.State;

    event Bid(
        address user,
        uint    accepted,
        uint    queued,
        uint    time
    );

    function bid(
        IAuctionData.State storage s,
        uint amount
        )
        internal
    {
        require(amount > 0, "zero amount");
        s.oedax.logParticipation(msg.sender);

        uint time = block.timestamp - s.startTime;
        uint weight = s.T > time? s.T - time : 0;
        uint accepted;
        uint queued;

        // calculate the current-state
        IAuctionData.Status memory i = s.getAuctionStatus();

        if (amount > i.bidAllowed) {
            // Part of the amount will be put in the queue.
            accepted = i.bidAllowed;
            queued = amount - i.bidAllowed;

            if (s.queueAmount > 0) {
                if (s.queueIsBidding) {
                    // Before this BID, the queue is for BIDs
                    assert(accepted == 0);
                } else {
                    // Before this BID, the queue is for ASKs, therefore we must have
                    // consumed all the pending ASKs in the queue.
                    assert(accepted > 0);
                    s.dequeue(s.queueAmount);
                }
            }
            s.queueIsBidding = true;
            s.enqueue(queued, weight);
        } else {
            // All amount are accepted into the auction.
            accepted = amount;
            queued = 0;

            uint consumed = s.calcAmountToDequeue(accepted);
            if (consumed > 0) {
                assert(s.queueIsBidding == false);
                s.dequeue(consumed);
            }
        }

        // Update the book keeping
        IAuctionData.Account storage account = s.accounts[msg.sender];

        account.bidAccepted = account.bidAccepted.add(accepted);
        account.bidFeeShare = account.bidFeeShare.add(accepted.mul(weight));

        s.bidAmount = s.bidAmount.add(accepted);

        if (s.bidShift != i.newBidShift) {
            s.bidShift = i.newBidShift;
            s.bidShifts.push(time);
            s.bidShifts.push(s.bidShift);
        }

        if (s.askShift != i.newAskShift) {
            s.askShift = i.newAskShift;
            s.askShifts.push(time);
            s.askShifts.push(s.askShift);
        }

        emit Bid(
            msg.sender,
            accepted,
            queued,
            block.timestamp
        );
    }
}