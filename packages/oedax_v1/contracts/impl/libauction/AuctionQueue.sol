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

/// @title AuctionQueue.
/// @author Daniel Wang  - <daniel@loopring.org>
library AuctionQueue
{
    using MathUint      for uint;
    using MathUint      for uint32;

    function getQueueConsumption(
        IAuctionData.State storage s,
        uint amount
        )
        internal
        view
        returns (uint)
    {
        // TODO
        return 0;
    }

    function dequeue(
        IAuctionData.State storage s,
        uint amount
        )
        internal
    {
      s.queueAmount = s.queueAmount.sub(amount);

      if (s.queueIsBid) {
        s.bidAmount = s.bidAmount.add(amount);
      } else {
        s.askAmount = s.askAmount.add(amount);
      }

      uint _amount = amount;
      uint idx = 0;

      while(_amount > 0) {
        IAuctionData.Queued storage item = s.queue[idx];
        IAuctionData.Balance storage balance = s.balanceMap[item.user][s.queueIsBid];

        if (item.amount > _amount) {
          balance.totalWeight = balance.totalWeight.add(item.time.mul(_amount));
          balance.queued = balance.queued.sub(_amount);

          item.amount = item.amount.sub(_amount);
        } else {
          balance.totalWeight = balance.totalWeight.add(item.time.mul(item.amount));
          balance.queued = balance.queued.sub(item.amount);

          _amount = _amount.sub(item.amount);
          idx += 1;
        }
      }

      if (idx > 0) {
        uint size = s.queue.length - idx;
        for (uint i = 0; i < size; i++) {
          s.queue[i] = s.queue[i + idx];
        }
        s.queue.length = size;
      }
    }

    /// @dev enqueue a bid or a ask
    /// Note that `queueIsBid` must be set to the right value before calling this method.
    function enqueue(
        IAuctionData.State storage s,
        uint amount,
        uint time
        )
        internal
    {
        s.queueAmount = s.queueAmount.add(amount);
        s.queue.push(IAuctionData.Queued(
            msg.sender,
            amount,
            time
        ));
    }
}