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

/// @title AuctionQueue.
/// @author Daniel Wang  - <daniel@loopring.org>
library AuctionQueue
{
    using MathUint for uint;

    function dequeue(
        IAuctionData.State storage s,
        uint amount
        )
        internal
    {
      uint _amount = amount;
      uint idx = 0;
      uint dequeued;

      // Q: Potentially very expensive or even dangerous.
      //    Even a single loop here is quite expensive, and as a user bidding/asking you could be
      //    paying the gas cost to update someone else's bids/asks.
      //    Security problem: Someone can fill the queue with a lot of (small) entries making this cost more
      //    than the Ethereum block limit. This way someone could probably stop anyone else from
      //    bidding/asking in this auction.
      while(_amount > 0) {
        IAuctionData.QueueItem storage item = s.Q.items[idx];
        IAuctionData.Account storage account = s.accounts[item.user];

        if (item.queued > _amount) {
          dequeued = _amount;
        } else {
          dequeued = item.queued;
          idx += 1;
        }

        item.queued = item.queued.sub(dequeued);
        _amount = _amount.sub(dequeued);

        if (s.Q.isBidding) {
            account.bidAccepted = account.bidAccepted.add(dequeued);
            account.bidQueued = account.bidQueued.sub(dequeued);
            account.bidFeeRebateWeight = account.bidFeeRebateWeight.add(dequeued.mul(item.weight));
        } else {
            account.askAccepted = account.askAccepted.add(dequeued);
            account.askQueued = account.askQueued.sub(dequeued);
            account.askFeeRebateWeight = account.askFeeRebateWeight.add(dequeued.mul(item.weight));
        }
      }

      // Q: It's probably cheaper to just use and update a start index instead of
      //    modifying the complete array.
      if (idx > 0) {
        uint size = s.Q.items.length - idx;
        for (uint i = 0; i < size; i++) {
          s.Q.items[i] = s.Q.items[i + idx];
        }
        s.Q.items.length = size;
      }

      s.Q.amount = s.Q.amount.sub(amount);

      if (s.Q.isBidding) {
        s.bidAmount = s.bidAmount.add(amount);
      } else {
        s.askAmount = s.askAmount.add(amount);
      }
    }

    /// @dev enqueue a bid or a ask
    /// Note that `queueIsBidding` must be set to the right value before calling this method.
    function enqueue(
        IAuctionData.State storage s,
        uint amount,
        uint weight
        )
        internal
    {
        IAuctionData.Account storage account = s.accounts[msg.sender];

        if (s.Q.isBidding) {
            account.bidQueued = account.bidQueued.add(amount);
        } else {
            account.askQueued = account.askQueued.add(amount);
        }

        s.Q.items.push(IAuctionData.QueueItem(
            msg.sender,
            amount,
            weight
        ));

        s.Q.amount = s.Q.amount.add(amount);
    }
}