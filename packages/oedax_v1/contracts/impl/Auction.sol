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
import "../lib/Ownable.sol";

/// @title An Implementation of ICurve.
/// @author Daniel Wang  - <daniel@loopring.org>
contract Auction is IAuction, Ownable
{
    using MathUint          for uint;
    using MathUint          for uint32;

    modifier onlyOedax {
      require (msg.sender == address(oedax));
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

        oedax = IOedax(oedax);
        curve = ICurve(_curve);

        owner = msg.sender; // creator
        auctionId = _auctionId;
        askToken = _askToken;
        bidToken = _bidToken;
        askAmount = initialAskAmount = _initialAskAmount;
        bidAmount = initialBidAmount = _initialBidAmount;
        startTime = block.timestamp;
        (P, S, M, T) = (_P, _S, _M, _T);
        // initTransfers();
    }

    // == Public & External Functions ==

    function()
        external
        payable
    {
        if (bidToken == address(0x0)) {
            bidInternal(msg.value);
        } else if (askToken == address(0x0)) {
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
            State memory s
        )
    {
         uint a = getSpendable(bidToken, amount);
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

    function getState()
        public
        view
        returns (State memory s)
    {
        s.askAmount = askAmount;
        s.bidAmount = bidAmount;
        s.queuedAskAmount = queueIsBid ? 0 : queueAmount;
        s.queuedBidAmount = queueIsBid ? 0 : queueAmount;

        if (askAmount > 0) {
            s.actualPrice  = bidAmount.mul(S) / askAmount;
            s.bounded = s.actualPrice >= P / M && s.actualPrice <= P.mul(M);
        }

        require(s.bounded || (askShift == 0 && bidShift == 0), "unbound shift");

        uint span;

        // calculating asks
        span = block.timestamp.sub(startTime).sub(askShift);
        s.askPrice = curve.getCurveValue(P, S, M, T, span);
        s.newAskShift = askShift;
        s.additionalBidAmountAllowed = ~uint256(0); // = uint.MAX

        if (s.bounded) {
            if (s.actualPrice > s.askPrice) {
                s.newAskShift = span
                    .add(askShift)
                    .sub(curve.getCurveTime(P, S, M, T, s.actualPrice ));
                s.askPrice = s.actualPrice;
                s.additionalBidAmountAllowed = 0;
            } else {
                s.additionalBidAmountAllowed = (
                    askAmount.add(s.queuedAskAmount).mul(s.askPrice ) / S
                ).sub(bidAmount);
            }
        }

        // calculating bids
        span = block.timestamp.sub(startTime).sub(bidShift);
        s.bidPrice = P.mul(P) / S / curve.getCurveValue(P, S, M, T, span);
        s.newBidShift = bidShift;
        s.additionalBidAmountAllowed = ~uint256(0); // = uint.MAX

        if (s.bounded) {
            if (s.actualPrice < s.bidPrice) {
                s.newAskShift = span
                    .add(bidShift)
                    .sub(curve.getCurveTime(P, S, M, T, askAmount.mul(P).mul(P) / bidAmount));
                s.bidPrice = s.actualPrice;
                s.additionalAskAmountAllowed = 0;
            } else {
                s.additionalAskAmountAllowed = (
                    askAmount.add(s.queuedBidAmount).mul(s.bidPrice) / S
                ).sub(bidAmount);
            }
        }

        if (queueAmount > 0) {
            require(queueIsBid || s.additionalAskAmountAllowed == 0);
            require(!queueIsBid || s.additionalBidAmountAllowed == 0);
        }
    }

    // == Internal & Private Functions ==
    function bidInternal(uint amount)
        internal
        returns(
            uint  _amount,
            uint  _queued,
            State memory s
        )
    {
        require(amount > 0, "zero amount");
         _amount = amount;

        // calculate the current-state
        s = getState();

        if (s.additionalBidAmountAllowed < _amount) {
            _queued = _amount.sub(s.additionalBidAmountAllowed);
            _amount = s.additionalBidAmountAllowed;
        }

        if (_queued > 0) {
            if (queueAmount > 0) {
                if (queueIsBid) {
                    // Before this BID, the queue is for BIDs
                    assert(_amount == 0);
                } else {
                    // Before this BID, the queue is for ASKs, therefore we must have
                    // consumed all the pending ASKs in the queue.
                    assert(_amount > 0);
                    dequeue(queueAmount);
                }
            }
            queueIsBid = true;
            enqueue(_queued);
        } else {
            assert(queueAmount == 0 || !queueIsBid);
            assert(_amount > 0);
            dequeue(getQueueConsumption(_amount, queueAmount));
        }

        // calculate the post-participation state
        s = getState();

        emit Bid(
            msg.sender,
            _amount,
            _queued,
            block.timestamp
        );
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
            .min(token.allowance(msg.sender, address(oedax)));
    }

}
