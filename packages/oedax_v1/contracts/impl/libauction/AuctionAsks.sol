pragma solidity 0.5.7;
pragma experimental ABIEncoderV2;

import "../../iface/IAuctionData.sol";

import "../../lib/MathUint.sol";

import "./AuctionInfo.sol";
import "./AuctionBalance.sol";
import "./AuctionQueue.sol";

/// @title AuctionAsks.
/// @author Daniel Wang  - <daniel@loopring.org>
library AuctionAsks
{
    using MathUint          for uint;
    using MathUint          for uint32;
    using AuctionInfo       for IAuctionData.State;
    using AuctionBalance    for IAuctionData.State;
    using AuctionQueue      for IAuctionData.State;

    event Ask(
        address user,
        uint    amount,
        uint    amountQueued,
        uint    time
    );

    function ask(
        IAuctionData.State storage s,
        uint amount
        )
        internal
        returns(
            uint  _amount,
            uint  _queued,
            IAuctionData.Info memory i
        )
    {
        require(amount > 0, "zero amount");
         _amount = amount;

        // calculate the current-state
        i = s.getAuctionInfo();

        // if (i.additionalBidAmountAllowed < _amount) {
        //     _queued = _amount.sub(i.additionalBidAmountAllowed);
        //     _amount = i.additionalBidAmountAllowed;
        // }

        // if (_queued > 0) {
        //     if (s.queueAmount > 0) {
        //         if (s.queueIsBid) {
        //             // Before this BID, the queue is for BIDs
        //             assert(_amount == 0);
        //         } else {
        //             // Before this BID, the queue is for ASKs, therefore we must have
        //             // consumed all the pending ASKs in the queue.
        //             assert(_amount > 0);
        //             s.dequeue(s.queueAmount);
        //         }
        //     }
        //     s.queueIsBid = true;
        //     s.enqueue(_queued);
        // } else {
        //     assert(s.queueAmount == 0 || !s.queueIsBid);
        //     assert(_amount > 0);
        //     s.dequeue(s.getQueueConsumption(_amount, s.queueAmount));
        // }

        // calculate the post-participation state
        i = s.getAuctionInfo();

        emit Ask(
            msg.sender,
            _amount,
            _queued,
            block.timestamp
        );
    }
}