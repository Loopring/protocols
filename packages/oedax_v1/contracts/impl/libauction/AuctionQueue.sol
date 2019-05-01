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
        uint amount,
        uint amountInQueue
        )
        internal
        view
        returns (uint)
    {
        return 0;
    }

    function dequeue(
        IAuctionData.State storage s,
        uint amount
        )
        internal
    {

    }
    function enqueue(
        IAuctionData.State storage s,
        uint amount
        )
        internal
    {

    }
}