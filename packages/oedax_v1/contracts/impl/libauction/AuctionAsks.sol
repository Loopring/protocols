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

import "./AuctionStatus.sol";
import "./AuctionAccount.sol";
import "./AuctionQueue.sol";

/// @title AuctionAsks.
/// @author Daniel Wang  - <daniel@loopring.org>
library AuctionAsks
{
    using MathUint          for uint;
    using AuctionStatus     for IAuctionData.State;
    using AuctionAccount    for IAuctionData.State;
    using AuctionQueue      for IAuctionData.State;

    event Ask(
        address user,
        uint    accepted,
        uint    queued,
        uint    time
    );

    function ask(
        IAuctionData.State storage s,
        uint amount
        )
        internal
    {
        require(amount > 0, "zero amount");
        if(s.oedax.logParticipation(msg.sender)) {
            s.users.push(msg.sender);
        }

        uint time = block.timestamp - s.startTime;
        uint weight = s.T > time? s.T - time : 0;
        uint accepted;
        uint queued;
        uint dequeued;

        // calculate the current-state
        IAuctionData.Status memory i = s.getAuctionStatus();

        if (amount > i.askAllowed) {
            // Part of the amount will be put in the queue.
            accepted = i.askAllowed;
            queued = amount - i.askAllowed;

            if (s.Q.amount > 0) {
                if (!s.Q.isBidding) {
                    // Before this ASK, the queue is for ASKs
                    assert(accepted == 0);
                } else {
                    // Before this ASK, the queue is for ASKs, therefore we must have
                    // consumed all the pending ASKs in the queue.
                    assert(accepted > 0);
                    s.dequeue(s.Q.amount);
                }
            }
            s.Q.isBidding = false;
            s.enqueue(queued, weight);
        } else {
            // All amount are accepted into the auction.
            accepted = amount;
            queued = 0;
            dequeued = (accepted.mul(i.actualPrice) / s.S).min(s.Q.amount);
            if (dequeued > 0) {
                assert(s.Q.isBidding == true);
                s.dequeue(dequeued);
            }
        }

        // Update the book keeping
        IAuctionData.Account storage account = s.accounts[msg.sender];

        account.askAccepted = account.askAccepted.add(accepted);
        account.askFeeRebateWeight = account.askFeeRebateWeight.add(accepted.mul(weight));

        s.askAmount = s.askAmount.add(accepted);

        if (s.askTimePush != i.newAskTimePush) {
            s.askTimePush = i.newAskTimePush;
            s.askTimePushs.push(time);
            s.askTimePushs.push(s.askTimePush);
        }

        if (s.askTimePush != i.newAskTimePush) {
            s.askTimePush = i.newAskTimePush;
            s.askTimePushs.push(time);
            s.askTimePushs.push(s.askTimePush);
        }

        emit Ask(
            msg.sender,
            accepted,
            queued,
            block.timestamp
        );
    }
}