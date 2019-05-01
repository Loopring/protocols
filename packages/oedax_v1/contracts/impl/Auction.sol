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

import "../iface/IAuction.sol";
import "../iface/ICurve.sol";

import "../lib/ERC20SafeTransfer.sol";
import "../lib/ERC20.sol";
import "../lib/MathUint.sol";


/// @title An Implementation of ICurve.
/// @author Daniel Wang  - <daniel@loopring.org>
contract Auction is IAuction
{
    using MathUint          for uint;
    using MathUint          for uint32;

    modifier onlyOedax {
      require (msg.sender == address(state.oedax));
      _;
    }

    // -- Constructor --
    constructor(
        address _oedax,
        uint    _auctionId,
        address _curve,
        address _askToken,
        address _bidToken,
        uint    _initialAskAmount,
        uint    _initialBidAmount,
        uint32  _P, // target price
        uint32  _S, // price scale
        uint8   _M, // price factor
        uint    _T
        )
        public
    {

        require(_oedax != address(0x0));
        require(_auctionId > 0);
        require(_curve != address(0x0));
        require(_askToken != address(0x0) || _bidToken != address(0x0));

        require(_P > 0);
        require(_M > 0);
        require(_P / _M > 0, "zero min price");
        require(_T % 3600 == 0, "duration must be in hour");
        require(_T / 3600 > 0 && _T / 3600 <= 30 * 24, "invalid duration");

        owner = msg.sender; // creator

        state.oedax = IOedax(_oedax);
        state.curve = ICurve(_curve);

        state.auctionId = _auctionId;
        state.askToken = _askToken;
        state.bidToken = _bidToken;
        state.initialAskAmount = _initialAskAmount;
        state.askAmount = _initialAskAmount;
        state.initialBidAmount = _initialBidAmount;
        state.bidAmount = _initialBidAmount;
        state.startTime = block.timestamp;
        state.P = _P;
        state.S = _S;
        state.M = _M;
        state.T = _T ;
        // initTransfers();
    }

    // == Public & External Functions ==

    function()
        external
        payable
    {
        if (state.bidToken == address(0x0)) {
            bidInternal(msg.value);
        } else if (state.askToken == address(0x0)) {
            // askInternal(msg.value);
        } else {
            revert();
        }
    }

    function bid(uint amount)
        public
        returns(
            uint  _amount,
            uint  _queued,
            Info memory i
        )
    {
         uint a = getSpendable(state.bidToken, amount);
         // TODO: do the transfer

         return bidInternal(a);
    }


    function getQueueConsumption(
        uint amount,
        uint amountInQueue
        )
        private
        view
        returns (uint)
    {
        return 0;
    }

    function getInfo()
        public
        view
        returns (Info memory i)
    {
        // i.askAmount = askAmount;
        // i.bidAmount = bidAmount;
        // i.queuedAskAmount = queueIsBid ? 0 : queueAmount;
        // i.queuedBidAmount = queueIsBid ? 0 : queueAmount;

        // if (askAmount > 0) {
        //     i.actualPrice  = bidAmount.mul(S) / askAmount;
        //     i.bounded = i.actualPrice >= P / M && i.actualPrice <= P.mul(M);
        // }

        // require(s.bounded || (askShift == 0 && bidShift == 0), "unbound shift");

        // uint span;

        // // calculating asks
        // span = block.timestamp.sub(startTime).sub(askShift);
        // i.askPrice = curve.getCurveValue(P, S, M, T, span);
        // i.newAskShift = askShift;
        // i.additionalBidAmountAllowed = ~uint256(0); // = uint.MAX

        // if (s.bounded) {
        //     if (s.actualPrice > i.askPrice) {
        //         i.newAskShift = span
        //             .add(askShift)
        //             .sub(curve.getCurveTime(P, S, M, T, i.actualPrice ));
        //         i.askPrice = i.actualPrice;
        //         i.additionalBidAmountAllowed = 0;
        //     } else {
        //         i.additionalBidAmountAllowed = (
        //             askAmount.add(s.queuedAskAmount).mul(s.askPrice ) / S
        //         ).sub(bidAmount);
        //     }
        // }

        // // calculating bids
        // span = block.timestamp.sub(startTime).sub(bidShift);
        // i.bidPrice = P.mul(P) / S / curve.getCurveValue(P, S, M, T, span);
        // i.newBidShift = bidShift;
        // i.additionalBidAmountAllowed = ~uint256(0); // = uint.MAX

        // if (s.bounded) {
        //     if (s.actualPrice < i.bidPrice) {
        //         i.newAskShift = span
        //             .add(bidShift)
        //             .sub(curve.getCurveTime(P, S, M, T, askAmount.mul(P).mul(P) / bidAmount));
        //         i.bidPrice = i.actualPrice;
        //         i.additionalAskAmountAllowed = 0;
        //     } else {
        //         i.additionalAskAmountAllowed = (
        //             askAmount.add(s.queuedBidAmount).mul(s.bidPrice) / S
        //         ).sub(bidAmount);
        //     }
        // }

        // if (queueAmount > 0) {
        //     require(queueIsBid || i.additionalAskAmountAllowed == 0);
        //     require(!queueIsBid || i.additionalBidAmountAllowed == 0);
        // }
    }

    // == Internal & Private Functions ==
    function bidInternal(uint amount)
        internal
        returns(
            uint  _amount,
            uint  _queued,
            Info memory i
        )
    {
        // require(amount > 0, "zero amount");
        //  _amount = amount;

        // // calculate the current-state
        // s = getInfo();

        // if (s.additionalBidAmountAllowed < _amount) {
        //     _queued = _amount.sub(s.additionalBidAmountAllowed);
        //     _amount = i.additionalBidAmountAllowed;
        // }

        // if (_queued > 0) {
        //     if (queueAmount > 0) {
        //         if (queueIsBid) {
        //             // Before this BID, the queue is for BIDs
        //             assert(_amount == 0);
        //         } else {
        //             // Before this BID, the queue is for ASKs, therefore we must have
        //             // consumed all the pending ASKs in the queue.
        //             assert(_amount > 0);
        //             dequeue(queueAmount);
        //         }
        //     }
        //     queueIsBid = true;
        //     enqueue(_queued);
        // } else {
        //     assert(queueAmount == 0 || !queueIsBid);
        //     assert(_amount > 0);
        //     dequeue(getQueueConsumption(_amount, queueAmount));
        // }

        // // calculate the post-participation state
        // s = getInfo();

        // emit Bid(
        //     msg.sender,
        //     _amount,
        //     _queued,
        //     block.timestamp
        // );
    }

    function dequeue(uint amount) private {}
    function enqueue(uint amount) private {}

    function getSpendable(
        address tokenAddr,
        uint    amount
        )
        private
        view
        returns (uint)
    {
        require(tokenAddr != address(0x0), "zero address");

        ERC20 token = ERC20(tokenAddr);
        return amount
            .min(token.balanceOf(msg.sender))
            .min(token.allowance(msg.sender, address(state.oedax)));
    }

}
