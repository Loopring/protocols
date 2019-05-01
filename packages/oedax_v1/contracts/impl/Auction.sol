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

import "../lib/MathUint.sol";
import "../lib/Ownable.sol";

/// @title An Implementation of ICurve.
/// @author Daniel Wang  - <daniel@loopring.org>
contract Auction is IAuction, Ownable
{
    using MathUint      for uint;
    using MathUint      for uint32;

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
        require(_askToken != address(0x0));
        require(_bidToken != address(0x0));

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

    // == Public Functions ==
    function getState()
        public
        view
        returns (State memory s)
    {
        s.queuedAskAmount = queueIsBid ? 0 : queueAmount;
        s.queuedBidAmount = queueIsBid ? 0 : queueAmount;

        if (askAmount > 0) {
            s.actualPrice  = bidAmount.mul(S) / askAmount;
            s.bounded = s.actualPrice >= P / M && s.actualPrice <= P.mul(M);
        }

        require(s.bounded || (askShift == 0 && bidShift == 0), "unbound shift");

        uint span;

        span = block.timestamp.sub(startTime).sub(askShift);
        s.askPrice = curve.getCurveValue(P, S, M, T, span);
        s.newAskShift = askShift;
        s.additionalAmountBidAllowed = ~uint256(0); // = uint.MAX

        if (s.bounded) {
            if (s.actualPrice > s.askPrice) {
                s.newAskShift = span
                    .add(askShift)
                    .sub(curve.getCurveTime(P, S, M, T, s.actualPrice ));
                s.askPrice = s.actualPrice;
                s.additionalAmountBidAllowed = 0;
            } else {
                s.additionalAmountBidAllowed = (
                    askAmount.add(s.queuedAskAmount).mul(s.askPrice ) / S
                ).sub(bidAmount);
            }
        }

        span = block.timestamp.sub(startTime).sub(bidShift);
        s.bidPrice = P.mul(P) / S / curve.getCurveValue(P, S, M, T, span);
        s.newBidShift = bidShift;
        s.additionalAmountBidAllowed = ~uint256(0); // = uint.MAX

        if (s.bounded) {
            if (s.actualPrice < s.bidPrice) {
                s.newAskShift = span
                    .add(bidShift)
                    .sub(curve.getCurveTime(P, S, M, T, askAmount.mul(P).mul(P) / bidAmount));
                s.bidPrice = s.actualPrice;
                s.additionalAmountAskAllowed = 0;
            } else {
                s.additionalAmountAskAllowed = (
                    askAmount.add(s.queuedBidAmount).mul(s.bidPrice) / S
                ).sub(bidAmount);
            }
        }
    }
}
